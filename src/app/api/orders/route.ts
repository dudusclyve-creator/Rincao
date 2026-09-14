import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit = Number(searchParams.get('limit') || 100);
  const orders = await prisma.order.findMany({
    where: status && status !== 'all' ? { status } : {},
    include: { items: true, customer: true, table: true, driver: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const b = await req.json();
  // upsert cliente pelo telefone
  let customerId: string | undefined;
  if (b.customerPhone) {
    const phone = String(b.customerPhone).replace(/\D/g, '');
    let cust = await prisma.customer.findUnique({ where: { phone } }).catch(() => null);
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          name: b.customerName || 'Cliente', phone,
          street: b.street || '', number: b.number || '', complement: b.complement || '',
          district: b.district || '', reference: b.reference || '',
        },
      });
    } else {
      await prisma.customer.update({ where: { id: cust.id }, data: { name: b.customerName || cust.name } });
    }
    customerId = cust.id;
  }
  // cupom
  let discount = Number(b.discount || 0);
  if (b.couponCode) {
    const cp = await prisma.coupon.findUnique({ where: { code: String(b.couponCode).toUpperCase() } });
    if (cp && cp.active && (!cp.expiresAt || cp.expiresAt > new Date()) && cp.used < cp.maxUses) {
      const sub = Number(b.subtotal || 0);
      if (sub >= cp.minValue) {
        discount = cp.kind === 'percent' ? (sub * cp.value) / 100 : cp.kind === 'fixed' ? cp.value : discount;
        if (cp.kind === 'frete_gratis') discount = Number(b.deliveryFee || 0);
        await prisma.coupon.update({ where: { id: cp.id }, data: { used: { increment: 1 } } });
      }
    }
  }
  const subtotal = Number(b.subtotal || 0);
  const fee = b.type === 'entrega' ? Number(b.deliveryFee || 0) : 0;
  const total = Math.max(0, subtotal + fee - discount);

  const last = await prisma.order.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
  const seq = (last?.number || 1024) + 1;

  const order = await prisma.order.create({
    data: {
      number: seq,
      customerId, customerName: b.customerName || '', customerPhone: b.customerPhone || '',
      addressText: b.addressText || '', type: b.type || 'entrega',
      status: 'novo', payment: b.payment || 'pix', changeFor: b.changeFor ? Number(b.changeFor) : null,
      subtotal, deliveryFee: fee, discount, couponCode: (b.couponCode || '').toUpperCase(),
      total, note: b.note || '', tableId: b.tableId || null, driverId: b.driverId || null,
      source: b.source || 'cardapio',
      items: { create: (b.items || []).map((it: any) => ({
        productId: it.productId || '', name: it.name, qty: Number(it.qty || 1),
        unitPrice: Number(it.unitPrice || 0), addonsJson: JSON.stringify(it.addons || []), note: it.note || '',
      })) },
      payments: { create: [{ method: b.payment || 'pix', amount: total }] },
    },
    include: { items: true },
  });
  await prisma.notification.create({ data: { kind: 'novo_pedido', text: `Novo pedido #${order.number} — ${order.customerName} — R$ ${total.toFixed(2)}` } });
  return NextResponse.json(order);
}

export async function PATCH(req: Request) {
  const b = await req.json();
  const order = await prisma.order.update({
    where: { id: b.id }, data: { status: b.status, driverId: b.driverId ?? undefined },
  });
  if (b.status === 'cancelado')
    await prisma.notification.create({ data: { kind: 'cancelado', text: `Pedido #${order.number} cancelado` } });
  if (b.status === 'pronto')
    await prisma.notification.create({ data: { kind: 'pronto', text: `Pedido #${order.number} pronto` } });
  return NextResponse.json(order);
}
