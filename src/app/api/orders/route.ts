import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

// "pix:20,dinheiro:30" -> [{method:'pix',amount:20},{method:'dinheiro',amount:30}]
// forma simples ("pix") -> [{method:'pix',amount:total}]
function parsePayments(payment: string, total: number): { method: string; amount: number }[] {
  const raw = String(payment || 'pix');
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const parsed: { method: string; amount: number }[] = [];
  for (const p of parts) {
    const i = p.lastIndexOf(':');
    if (i > 0) {
      const amount = Number(p.slice(i + 1));
      if (Number.isFinite(amount) && amount > 0) { parsed.push({ method: p.slice(0, i), amount: Math.round(amount * 100) / 100 }); continue; }
    }
    parsed.push({ method: p, amount: 0 });
  }
  if (parsed.length === 0) return [{ method: 'pix', amount: total }];
  if (parsed.every((x) => x.amount === 0)) return [{ method: parsed[0].method, amount: total }];
  const sum = parsed.reduce((s, x) => s + x.amount, 0);
  let diff = Math.round((total - sum) * 100) / 100;
  if (diff < 0) {
    // remove a diferenca das ultimas parcelas sem deixar nenhuma negativa
    for (let i = parsed.length - 1; i >= 0 && diff < -0.005; i--) {
      const take = Math.min(parsed[i].amount, Math.round(-diff * 100) / 100);
      parsed[i].amount = Math.round((parsed[i].amount - take) * 100) / 100;
      diff = Math.round((diff + take) * 100) / 100;
    }
  } else if (diff > 0.005 && parsed.length) {
    parsed[parsed.length - 1].amount = Math.round((parsed[parsed.length - 1].amount + diff) * 100) / 100;
  }
  return parsed.filter((x) => x.amount > 0);
}

function addonsOf(it: any): any[] {
  if (Array.isArray(it.addons)) return it.addons;
  try { return JSON.parse(it.addonsJson || '[]'); } catch { return []; }
}

function lineTotal(it: any): number {
  const extra = addonsOf(it).reduce((s: number, a: any) => s + Number(a.price || 0) * Number(a.qty || 1), 0);
  return Number(it.qty || 0) * (Number(it.unitPrice || 0) + extra);
}

// Mantem payments, string de pagamento e movimentos do caixa batendo com o total novo
// (devolve a string de pagamento final)
async function syncOrderMoney(orderId: string, number: number, total: number): Promise<string> {
  const ord = await prisma.order.findUnique({ where: { id: orderId } });
  if (!ord) return '';
  let paymentStr = String(ord.payment || 'pix');
  const parts = parsePayments(paymentStr, total);
  if (paymentStr.includes(',')) {
    const norm = parts.map((x) => `${x.method}:${x.amount}`).join(',');
    if (norm !== paymentStr) { paymentStr = norm; await prisma.order.update({ where: { id: orderId }, data: { payment: paymentStr } }); }
  }
  await prisma.payment.deleteMany({ where: { orderId } });
  await prisma.payment.createMany({ data: parts.map((p) => ({ orderId, method: p.method, amount: p.amount })) });
  const openReg = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' } });
  if (openReg) {
    const hasMv = await prisma.cashMovement.count({ where: { orderId, kind: 'venda', registerId: openReg.id } });
    if (hasMv > 0) {
      await prisma.cashMovement.deleteMany({ where: { orderId, kind: 'venda', registerId: openReg.id } });
      for (const p of parts) {
        await prisma.cashMovement.create({ data: { registerId: openReg.id, kind: 'venda', method: p.method, amount: p.amount, reason: `Pedido #${number}`, orderId } });
      }
    }
  }
  return paymentStr;
}

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
    const newSubtotal = remaining.reduce((s: number, it: any) => s + lineTotal(it), 0);
    const newTotal = Math.max(0, newSubtotal + (order.type === 'entrega' ? order.deliveryFee : 0) - order.discount);
    if (remaining.length === 0) {
      // apagou o ultimo item: estorna a venda do caixa antes de remover o pedido
      const openReg = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' } });
      if (openReg) await prisma.cashMovement.deleteMany({ where: { orderId: order.id, kind: 'venda', registerId: openReg.id } });
      await prisma.order.delete({ where: { id: order.id } });
    } else {
      await prisma.order.update({ where: { id: order.id }, data: { subtotal: newSubtotal, total: newTotal } });
      await syncOrderMoney(order.id, order.number, newTotal);
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
    const addedTotal = newItems.reduce((s: number, it: any) => s + lineTotal(it), 0);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { subtotal: order.subtotal + addedTotal, total: order.total + addedTotal },
      include: { items: true, customer: true, table: true, driver: true },
    });
    updated.payment = await syncOrderMoney(order.id, order.number, updated.total);
    for (const it of newItems) {
      if (!it.productId) continue;
      const prod = await prisma.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
      if (prod?.inventoryItemId) {
        await prisma.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { decrement: it.qty } } });
      }
    }
    return NextResponse.json(updated);
  }

  if (b.action === 'edit') {
    const order = await prisma.order.findUnique({ where: { id: b.orderId }, include: { items: true } });
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    if (order.status === 'cancelado') return NextResponse.json({ error: 'Pedido cancelado não pode ser editado' }, { status: 400 });
    if (order.nfeStatus === 'issued') return NextResponse.json({ error: 'Nota fiscal emitida — cancele a nota antes de editar o pedido' }, { status: 400 });

    const newItems = (b.items || []).map((it: any) => ({
      productId: it.productId || '', name: String(it.name || ''),
      qty: Math.max(1, Number(it.qty || 1)), unitPrice: Number(it.unitPrice || 0),
      addonsJson: JSON.stringify(it.addons || []), note: it.note || '',
    }));
    if (newItems.length === 0) return NextResponse.json({ error: 'O pedido precisa ter pelo menos 1 item' }, { status: 400 });

    // devolve estoque dos itens antigos
    for (const it of order.items) {
      if (!it.productId) continue;
      const prod = await prisma.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
      if (prod?.inventoryItemId) await prisma.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { increment: it.qty } } });
    }
    // baixa estoque dos novos itens
    for (const it of newItems) {
      if (!it.productId) continue;
      const prod = await prisma.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
      if (prod?.inventoryItemId) await prisma.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { decrement: it.qty } } });
    }

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.createMany({ data: newItems.map((it: any) => ({ ...it, orderId: order.id })) });

    const subtotal = newItems.reduce((s: number, it: any) => s + lineTotal(it), 0);
    const type = b.type !== undefined ? String(b.type) : order.type;
    const fee = type === 'entrega' ? Number(b.deliveryFee ?? order.deliveryFee) : 0;
    const discount = Number(b.discount ?? order.discount);
    const total = Math.max(0, subtotal + fee - discount);

    // cliente (relinka quando o telefone muda)
    let customerId = order.customerId ?? null;
    if (b.customerPhone !== undefined) {
      const phone = String(b.customerPhone || '').replace(/\D/g, '');
      if (phone) {
        let cust = await prisma.customer.findUnique({ where: { phone } }).catch(() => null);
        if (!cust) {
          cust = await prisma.customer.create({ data: { name: b.customerName || order.customerName || 'Cliente', phone } });
        }
        customerId = cust.id;
      }
    }

    // CPF do cliente (exigido na NFC-e de entrega)
    if (b.customerCpf !== undefined && String(b.customerCpf || '').replace(/\D/g, '')) {
      const cpf = String(b.customerCpf).replace(/\D/g, '');
      let cust = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }) : null;
      if (!cust) {
        const phone = String(b.customerPhone || '').replace(/\D/g, '');
        if (phone) cust = await prisma.customer.findUnique({ where: { phone } }).catch(() => null);
      }
      if (cust) {
        if (cust.cpf !== cpf) await prisma.customer.update({ where: { id: cust.id }, data: { cpf } });
      } else {
        const key = String(b.customerPhone || '').replace(/\D/g, '') || cpf;
        const created = await prisma.customer.create({ data: { name: b.customerName || order.customerName || 'Cliente', phone: key, cpf } }).catch(() => null);
        if (created) customerId = created.id;
      }
    }

    const data: any = {
      customerName: b.customerName !== undefined ? String(b.customerName) : order.customerName,
      customerPhone: b.customerPhone !== undefined ? String(b.customerPhone) : order.customerPhone,
      addressText: b.addressText !== undefined ? String(b.addressText) : order.addressText,
      type, payment: b.payment !== undefined ? String(b.payment) : order.payment,
      changeFor: b.changeFor !== undefined ? (b.changeFor ? Number(b.changeFor) : null) : order.changeFor,
      note: b.note !== undefined ? String(b.note) : order.note,
      subtotal, deliveryFee: fee, discount, total, customerId,
    };
    const updated = await prisma.order.update({ where: { id: order.id }, data, include: { items: true, customer: true, table: true, driver: true } });

    updated.payment = await syncOrderMoney(order.id, order.number, total);

    return NextResponse.json(updated);
  }

  // upsert cliente pelo telefone
  let customerId: string | undefined;
  if (b.customerPhone) {
    const phone = String(b.customerPhone).replace(/\D/g, '');
    const cpf = String(b.customerCpf || '').replace(/\D/g, '');
    let cust = await prisma.customer.findUnique({ where: { phone } }).catch(() => null);
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          name: b.customerName || 'Cliente', phone, cpf,
          street: b.street || '', number: b.number || '', complement: b.complement || '',
          district: b.district || '', reference: b.reference || '',
        },
      });
    } else {
      const updateData: any = { name: b.customerName || cust.name };
      if (b.customerCpf) updateData.cpf = cpf; // so preenche/atualiza quando informado (nao apaga)
      if (b.street) updateData.street = b.street;
      if (b.number) updateData.number = b.number;
      if (b.complement) updateData.complement = b.complement;
      if (b.district) updateData.district = b.district;
      await prisma.customer.update({ where: { id: cust.id }, data: updateData });
    }
    customerId = cust.id;
  } else if (String(b.customerCpf || '').replace(/\D/g, '')) {
    // sem telefone mas com CPF (PDV): localiza pelo CPF ou cria usando o CPF como chave
    const cpf = String(b.customerCpf).replace(/\D/g, '');
    let cust = await prisma.customer.findFirst({ where: { cpf } }).catch(() => null);
    if (!cust) {
      cust = await prisma.customer.create({ data: { name: b.customerName || 'Cliente', phone: cpf, cpf } }).catch(() => null);
      if (!cust) cust = await prisma.customer.findUnique({ where: { phone: cpf } }).catch(() => null);
    }
    if (cust) {
      if (b.customerName) await prisma.customer.update({ where: { id: cust.id }, data: { name: b.customerName } });
      customerId = cust.id;
    }
  }
  const itemsIn = Array.isArray(b.items) ? b.items : [];
  const subtotal = itemsIn.length > 0 ? itemsIn.reduce((s: number, it: any) => s + lineTotal(it), 0) : Number(b.subtotal || 0);
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
      source: b.source || 'cardapio', emitRequested: !!b.emitRequested,
      items: { create: (b.items || []).map((it: any) => ({
        productId: it.productId || '', name: it.name, qty: Number(it.qty || 1),
        unitPrice: Number(it.unitPrice || 0), addonsJson: JSON.stringify(it.addons || []), note: it.note || '',
      })) },
      payments: { create: parsePayments(b.payment || 'pix', total).map((p) => ({ method: p.method, amount: p.amount })) },
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

  // pedidos de mesa pagam somente no fechamento da mesa (mesas/closeTable)
  if (b.source === 'cardapio' && (b.type || 'entrega') !== 'mesa') {
    const open = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' } });
    if (open) {
      for (const p of parsePayments(b.payment || 'pix', total)) {
        await prisma.cashMovement.create({ data: { registerId: open.id, kind: 'venda', method: p.method, amount: p.amount, reason: `Pedido #${order.number}`, orderId: order.id } });
      }
    }
  }

  return NextResponse.json(order);
}

export async function PATCH(req: Request) {
  const b = await req.json();
  const data: any = {};
  if (b.status) {
    data.status = b.status;
    data.endedAt = (b.status === 'concluido' || b.status === 'cancelado') ? new Date() : null;
  }
  if (b.driverId !== undefined) data.driverId = b.driverId;
  if (b.tableId !== undefined) data.tableId = b.tableId || null;
  if (b.customerName !== undefined) data.customerName = b.customerName;
  if (b.payment !== undefined) data.payment = b.payment;
  if (b.changeFor !== undefined) data.changeFor = b.changeFor;
  if (b.note !== undefined) data.note = b.note;
  if (b.discount !== undefined) data.discount = b.discount;
  if (b.printed) data.printCount = { increment: 1 }; // registra 1a impressao da comanda
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
    // estorna a venda do caixa (so no caixa aberto; caixa fechado nao pode ser alterado)
    const openReg = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' } });
    if (openReg) await prisma.cashMovement.deleteMany({ where: { orderId: order.id, kind: 'venda', registerId: openReg.id } });
  }
  if (b.status === 'pronto')
    await prisma.notification.create({ data: { kind: 'pronto', text: `Pedido #${order.number} pronto` } });
  return NextResponse.json(order);
}
