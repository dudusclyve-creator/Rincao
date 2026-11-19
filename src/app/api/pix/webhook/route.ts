import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { getPixConfig, getPixPayment, syncPixOrder } from '@/lib/pix';

// Webhook do Mercado Pago. Precisa ser publico (o MP chama de fora), por isso
// nunca confia no corpo: busca o pagamento na API do MP e aplica no pedido.
async function handle(req: Request) {
  try {
    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch {}
    const type = String(url.searchParams.get('type') || url.searchParams.get('topic') || body?.type || body?.action || '');
    const paymentId = String(url.searchParams.get('data.id') || body?.data?.id || body?.id || '');
    if (!paymentId || (type && !/payment/i.test(type))) return NextResponse.json({ ok: true });

    const cfg = await getPixConfig(true, true);
    if (!cfg) return NextResponse.json({ ok: true });

    const payment = await getPixPayment(cfg, paymentId);
    const orderId = String(payment?.external_reference || '');
    let order = orderId ? await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } }).catch(() => null) : null;
    if (!order) order = await prisma.order.findFirst({ where: { pixPaymentId: paymentId }, select: { id: true } }).catch(() => null);
    if (order) await syncPixOrder(order.id);
  } catch (e: any) {
    console.error('[pix webhook]', e?.message || e);
  }
  // sempre 200: se responder erro o MP fica reenviando a mesma notificacao
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
