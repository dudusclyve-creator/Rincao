import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { handleNfe } from '@/lib/nfe-api';
import { nfeProxySign } from '@/lib/nfe-proxy';

export async function POST(req: Request) {
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const action = String(b?.action || '');
  const remoto = String(process.env.NFE_REMOTE_URL || '').replace(/\/+$/, '');
  const semCertificado = !process.env.NFE_CERT_PFX_B64;

  // App portatil: sem certificado local, quem assina/envia para a SEFAZ e o site
  // (mesmo banco). O status continua sendo lido direto do banco aqui.
  if (semCertificado && remoto && ['test', 'emit', 'cancel'].includes(action)) {
    try {
      const raw = JSON.stringify(b);
      const r = await fetch(`${remoto}/api/nfe-remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rincao-sign': nfeProxySign(raw) },
        body: raw,
      });
      const data = await r.json().catch(() => ({}));
      return NextResponse.json(data, { status: r.status });
    } catch (e: any) {
      return NextResponse.json(
        { error: `Sem conexão com o emissor de notas (${remoto}): ${e?.message || 'falha de rede'}` },
        { status: 502 }
      );
    }
  }

  const r = await handleNfe(b);
  return NextResponse.json(r.body, { status: r.status });
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
