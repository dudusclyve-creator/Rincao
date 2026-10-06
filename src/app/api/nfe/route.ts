import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { cancelar, statusServico, amb } from '@/lib/nfe';
import { emitirPedido } from '@/lib/nfe-order';

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
      const r = await emitirPedido(orderId);
      if (r.ok) return NextResponse.json({ status: 'issued', numero: r.numero, chave: r.chave, nProt: r.nProt });
      return NextResponse.json({ error: r.error }, { status: r.http || 502 });
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
      return NextResponse.json({ error: r.erro ? `${r.erro}${/^\s*501\b/.test(r.erro) ? ' — A legislação permite cancelar NFC-e somente em até 30 minutos após a emissão.' : ''}` : 'Falha ao cancelar' }, { status: 502 });
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
