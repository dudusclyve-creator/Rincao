import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
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
  } catch (e: any) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const b = await req.json();

  if (b.action === 'removeItem') {
    const order = await prisma.order.findUnique({ where: { id: b.orderId }, include: { items: true } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const item = order.items[b.itemIndex];
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    await prisma.orderItem.delete({ where: { id: item.id } });
    if (item.productId) {
      const prod = await prisma.product.findUnique({ where: { id: item.productId }, select: { inventoryItemId: true } });
      if (prod?.inventoryItemId) {
        await prisma.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { increment: item.qty } } });
      }
    }
    const remaining = order.items.filter((_: any, i: number) => i !== b.itemIndex);
    const newSubtotal = remaining.reduce((s: number, it: any) => s + it.qty * it.unitPrice, 0);
    const newTotal = Math.max(0, newSubtotal + (order.type === 'entrega' ? order.deliveryFee : 0) - order.discount);
    if (remaining.length === 0) {
      await prisma.order.delete({ where: { id: order.id } });
    } else {
      await prisma.order.update({ where: { id: order.id }, data: { subtotal: newSubtotal, total: newTotal } });
    }
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'addItems') {
    const order = await prisma.order.findUnique({ where: { id: b.orderId }, include: { items: true } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const newItems = (b.items || []).map((it: any) => ({
      orderId: order.id, productId: it.productId || '', name: it.name, qty: Number(it.qty || 1),
      unitPrice: Number(it.unitPrice || 0), addonsJson: JSON.stringify(it.addons || []), note: it.note || '',
    }));
    await prisma.orderItem.createMany({ data: newItems });
    const addedTotal = newItems.reduce((s: number, it: any) => s + it.qty * it.unitPrice, 0);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { subtotal: order.subtotal + addedTotal, total: order.total + addedTotal },
      include: { items: true, customer: true, table: true, driver: true },
    });
    for (const it of newItems) {
      if (!it.productId) continue;
      const prod = await prisma.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
      if (prod?.inventoryItemId) {
        await prisma.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { decrement: it.qty } } });
      }
    }
    return NextResponse.json(updated);
  }

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
      const updateData: any = { name: b.customerName || cust.name };
      if (b.street) updateData.street = b.street;
      if (b.number) updateData.number = b.number;
      if (b.complement) updateData.complement = b.complement;
      if (b.district) updateData.district = b.district;
      await prisma.customer.update({ where: { id: cust.id }, data: updateData });
    }
    customerId = cust.id;
  }
  const subtotal = Number(b.subtotal || 0);
  const fee = b.type === 'entrega' ? Number(b.deliveryFee || 0) : 0;
  const total = Math.max(0, subtotal + fee - Number(b.discount || 0));

  const turnoSetting = await prisma.setting.findUnique({ where: { key: 'turno_number' } });
  const turnoId = turnoSetting?.value || '1';
  const lastOrder = await prisma.order.findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const seq = lastOrder ? lastOrder.number + 1 : 1;

  const order = await prisma.order.create({
    data: {
      number: seq,
      turnoId,
      customerId, customerName: b.customerName || '', customerPhone: b.customerPhone || '',
      addressText: b.addressText || '', type: b.type || 'entrega',
      status: 'novo', payment: b.payment || 'pix', changeFor: b.changeFor ? Number(b.changeFor) : null,
      subtotal, deliveryFee: fee, discount: Number(b.discount || 0),
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

  // Deduzir estoque de bebidas (produtos com inventoryItemId vinculado)
  for (const it of (b.items || [])) {
    if (!it.productId) continue;
    const prod = await prisma.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
    if (prod?.inventoryItemId) {
      await prisma.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { decrement: Number(it.qty || 1) } } });
    }
  }

  if (b.source === 'cardapio') {
    const open = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' } });
    if (open) {
      await prisma.cashMovement.create({ data: { registerId: open.id, kind: 'venda', method: b.payment || 'pix', amount: total, reason: `Pedido #${order.number}`, orderId: order.id } });
    }
  }

  return NextResponse.json(order);
}

export async function PATCH(req: Request) {
  const b = await req.json();
  const data: any = {};
  if (b.status) data.status = b.status;
  if (b.driverId !== undefined) data.driverId = b.driverId;
  if (b.tableId !== undefined) data.tableId = b.tableId || null;
  if (b.customerName !== undefined) data.customerName = b.customerName;
  if (b.payment !== undefined) data.payment = b.payment;
  if (b.changeFor !== undefined) data.changeFor = b.changeFor;
  if (b.note !== undefined) data.note = b.note;
  if (b.discount !== undefined) data.discount = b.discount;
  const order = await prisma.order.update({ where: { id: b.id }, data });
  if (b.status === 'cancelado') {
    await prisma.notification.create({ data: { kind: 'cancelado', text: `Pedido #${order.number} cancelado` } });
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    for (const it of items) {
      if (!it.productId) continue;
      const prod = await prisma.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
      if (prod?.inventoryItemId) {
        await prisma.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { increment: it.qty } } });
      }
    }
  }
  if (b.status === 'pronto')
    await prisma.notification.create({ data: { kind: 'pronto', text: `Pedido #${order.number} pronto` } });
  return NextResponse.json(order);
}
