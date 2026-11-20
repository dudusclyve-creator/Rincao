import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { cancelPixPayment, createPixCharge, getPixConfig, switchPixPayment, syncPixOrder } from '@/lib/pix';

// PIX automatico (Mercado Pago) do cardapio (retirada / consumo no local) e do
// PDV (balcao / retirada). O pedido ja nasce aguardando pagamento; aqui geramos
// o QR com o valor e o polling confirma. Pedido de entrega e mesa ficam de fora.

// Balcao e retirada do cardapio/PDV, consumo no local e a mesa do PDV (o
// cliente sentado na mesa escaneia o QR que o operador abre na tela).
// Mesa vinda do QR do cardapio paga no fechamento da mesa e fica de fora.
const ALLOWED_TYPES = ['retirada', 'local', 'balcao'];

const hits = new Map<string, number[]>();
function rateLimited(ip: string, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

const lastCheck = new Map<string, number>();

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 }); }
  const orderId = String(b?.orderId || '');
  if (!orderId) return NextResponse.json({ error: 'Pedido nao informado' }, { status: 400 });

  const ip = String(req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (rateLimited(ip)) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });

  const cfg = await getPixConfig();
  if (!cfg) return NextResponse.json({ error: 'PIX automatico nao configurado no painel' }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId } }).catch(() => null);
  if (!order) return NextResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 });
  if (order.paidAt) return NextResponse.json({ error: 'Pedido ja pago', status: 'approved' }, { status: 409 });
  if (String(order.payment || '') !== 'pix') return NextResponse.json({ error: 'Pedido nao e PIX' }, { status: 400 });
  const type = String(order.type || '');
  const typeOk = ALLOWED_TYPES.includes(type) || (type === 'mesa' && order.source === 'pdv');
  if (!typeOk) {
    return NextResponse.json({ error: 'PIX automatico so vale para balcao/retirada/mesa do PDV' }, { status: 400 });
  }
  if (!['aguardando_pagamento', 'cancelado'].includes(String(order.status))) {
    return NextResponse.json({ error: 'Pedido nao esta aguardando pagamento' }, { status: 400 });
  }
  if (!(Number(order.total) > 0)) return NextResponse.json({ error: 'Pedido sem valor' }, { status: 400 });

  const register = order.pixRegisterId
    ? { id: order.pixRegisterId }
    : await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' }, select: { id: true } });

  let charge;
  try {
    charge = await createPixCharge(cfg, {
      amount: Number(order.total),
      description: `Pedido #${order.number} - Rincao Lanches`,
      externalReference: order.id,
      payerPhone: order.customerPhone,
      expiresInMinutes: 30,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Falha ao gerar o PIX' }, { status: 502 });
  }

  const token = order.pixToken || randomBytes(18).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  await prisma.order.update({
    where: { id: order.id },
    data: {
      pixPaymentId: charge.id,
      pixToken: token,
      pixQr: charge.qr,
      pixQrImage: charge.qrImage,
      pixStatus: 'pending',
      pixExpiresAt: expiresAt,
      pixRegisterId: register?.id || null,
      status: 'aguardando_pagamento',
    },
  });

  return NextResponse.json({
    orderId: order.id,
    number: order.number,
    total: order.total,
    status: 'pending',
    qr: charge.qr,
    qrImage: charge.qrImage,
    expiresAt: expiresAt.toISOString(),
    token,
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = String(searchParams.get('orderId') || '');
  const token = String(searchParams.get('token') || '');
  if (!orderId) return NextResponse.json({ error: 'Pedido nao informado' }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId } }).catch(() => null);
  if (!order) return NextResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 });
  if (order.pixToken && token !== order.pixToken) {
    return NextResponse.json({ error: 'Link invalido' }, { status: 403 });
  }

  // no maximo uma consulta ao Mercado Pago a cada 3s por pedido
  const now = Date.now();
  const prev = lastCheck.get(orderId) || 0;
  let status: string = order.paidAt ? 'approved' : String(order.pixStatus || 'none');
  if (!order.paidAt && now - prev > 3000) {
    lastCheck.set(orderId, now);
    const r = await syncPixOrder(orderId);
    status = r.status === 'none' ? String(order.pixStatus || 'none') : r.status;
  }

  const fresh = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, number: true, total: true, status: true, paidAt: true, pixStatus: true,
      pixQr: true, pixQrImage: true, pixExpiresAt: true,
    },
  });

  return NextResponse.json({
    orderId,
    number: fresh?.number,
    total: fresh?.total,
    status: fresh?.paidAt ? 'approved' : status,
    paid: !!fresh?.paidAt,
    qr: fresh?.pixQr || '',
    qrImage: fresh?.pixQrImage || '',
    expiresAt: fresh?.pixExpiresAt ? new Date(fresh.pixExpiresAt).toISOString() : null,
  });
}

export async function PATCH(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {}
  const orderId = String(b?.orderId || '');
  if (!orderId) return NextResponse.json({ error: 'Pedido nao informado' }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: orderId } }).catch(() => null);
  if (!order) return NextResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 });

  if (b?.action === 'check') {
    const r = await syncPixOrder(orderId);
    return NextResponse.json({ status: r.status, paid: r.status === 'approved' });
  }

  if (b?.action === 'cancel') {
    const cfg = await getPixConfig(false, true);
    if (cfg && order.pixPaymentId && !order.paidAt) await cancelPixPayment(cfg, order.pixPaymentId);
    await prisma.order.updateMany({
      where: { id: orderId, paidAt: null },
      data: { pixStatus: 'cancelled', ...(order.status === 'aguardando_pagamento' ? { status: 'cancelado' } : {}) },
    });
    return NextResponse.json({ ok: true });
  }

  // PDV: cliente nao vai pagar o PIX (QR na tela) e escolheu outro metodo.
  // Cancela a cobranca e fecha a mesma venda, sem trocar o numero do pedido.
  if (b?.action === 'switch') {
    try {
      const r = await switchPixPayment(orderId, String(b?.payment || ''));
      return NextResponse.json(r);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Nao foi possivel trocar o pagamento' }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'acao invalida' }, { status: 400 });
}
