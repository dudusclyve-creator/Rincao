import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { emitir, cancelar, statusServico, amb } from '@/lib/nfe';

async function getFiscal() {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'fiscal' } });
    return s ? JSON.parse(s.value) : {};
  } catch { return {}; }
}

async function nextNumero(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'nfeCounter' } });
  const last = s ? (JSON.parse(s.value).last || 0) : 0;
  return last + 1;
}

async function saveNumero(numero: number) {
  try {
    await prisma.setting.upsert({
      where: { key: 'nfeCounter' },
      create: { key: 'nfeCounter', value: JSON.stringify({ last: numero }) },
      update: { value: JSON.stringify({ last: numero }) },
    });
  } catch {}
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const { action, orderId } = b;

    if (action === 'test') {
      try {
        const st = await statusServico();
        return NextResponse.json(st);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Falha ao consultar a SEFAZ' }, { status: 502 });
      }
    }

    if (!orderId) return NextResponse.json({ error: 'Pedido não informado' }, { status: 400 });
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, customer: true } });
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

    if (action === 'emit') {
      if (order.nfeStatus && order.nfeStatus !== 'error') {
        return NextResponse.json({ error: 'Este pedido já tem nota fiscal' }, { status: 409 });
      }
      if (/rivera/i.test(order.addressText || '')) {
        return NextResponse.json({ error: 'Entrega em Rivera (exterior) — a NFC-e não aceita destino fora do Brasil. Emita a NF-e manualmente pelo contador.' }, { status: 400 });
      }
      // NFC-e de entrega (indPres=4) exige CPF do destinatario (rej 787)
      const entregaSemCpf =
        (order.type || '') === 'entrega' &&
        !String(order.addressText || '').toUpperCase().includes('RETIRADA') &&
        !String(order.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL') &&
        String(order.customer?.cpf || '').replace(/\D/g, '').length !== 11;
      if (entregaSemCpf) {
        return NextResponse.json({ error: 'Pedido de entrega sem CPF do cliente. A NFC-e de entrega exige o CPF do destinatário — cadastre o CPF no menu Clientes e tente novamente.' }, { status: 400 });
      }
      if (!order.items.length) return NextResponse.json({ error: 'Pedido sem itens' }, { status: 400 });
      if (!process.env.NFE_CERT_PFX_B64) return NextResponse.json({ error: 'NFE_CERT_PFX_B64 não configurada no .env da Vercel' }, { status: 500 });

      const fiscal = await getFiscal();
      const numero = await nextNumero();
      let r;
      try {
        r = await emitir(order, fiscal, numero);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Falha ao enviar para a SEFAZ' }, { status: 502 });
      }
      if (r.ok) {
        await saveNumero(numero);
        await prisma.order.update({
          where: { id: order.id },
          data: {
            nfeStatus: 'issued',
            nfeNumber: numero,
            nfeKey: r.chave || null,
            nfeProtocol: r.nProt || null,
            nfeXml: r.xml || null,
            nfeQrCode: r.qrUrl || null,
            nfeError: null,
            nfeIssuedAt: new Date(),
            nfeCancelledAt: null,
          },
        });
        return NextResponse.json({ status: 'issued', numero, chave: r.chave, nProt: r.nProt });
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { nfeStatus: 'error', nfeError: (r.erro || 'Erro desconhecido').slice(0, 500), nfeKey: r.chave || null },
      });
      if ((r as any).xml) {
        try {
          const { writeFileSync } = await import('fs');
          writeFileSync('last_rejected.xml', (r as any).xml);
        } catch {}
      }
      return NextResponse.json({ error: r.erro || 'A SEFAZ rejeitou a nota' }, { status: 502 });
    }

    if (action === 'status') {
      // estado gravado no banco (emissao e sincrona)
      return NextResponse.json({
        status: order.nfeStatus,
        numero: order.nfeNumber,
        chave: order.nfeKey,
        error: order.nfeError,
        ambiente: amb(),
      });
    }

    if (action === 'cancel') {
      if (order.nfeStatus !== 'issued') return NextResponse.json({ error: 'Só é possível cancelar nota já emitida' }, { status: 400 });
      if (!order.nfeKey || !order.nfeProtocol) return NextResponse.json({ error: 'Nota sem chave/protocolo para cancelar' }, { status: 400 });
      const motivo = String(b.motivo || '').trim();
      if (motivo.length < 15) return NextResponse.json({ error: 'Motivo precisa de ao menos 15 caracteres (exigência da SEFAZ)' }, { status: 400 });
      let r;
      try {
        r = await cancelar(order.nfeKey, order.nfeProtocol, motivo);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Falha ao cancelar na SEFAZ' }, { status: 502 });
      }
      if (r.ok) {
        await prisma.order.update({
          where: { id: order.id },
          data: { nfeStatus: 'cancelled', nfeCancelledAt: new Date(), nfeError: motivo.slice(0, 500) },
        });
        return NextResponse.json({ status: 'cancelled' });
      }
      return NextResponse.json({ error: r.erro || 'Falha ao cancelar' }, { status: 502 });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

// download do XML da nota
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'Pedido não informado' }, { status: 400 });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order?.nfeXml) return NextResponse.json({ error: 'XML da nota não encontrado' }, { status: 404 });
    return new NextResponse(order.nfeXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="nfce-${order.nfeNumber || order.number}.xml"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
