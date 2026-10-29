import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import * as jose from 'jose';
import { prisma } from '@/lib/db';
import { parseAddress } from '@/lib/address';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-trocar');

// O cardápio é público, então o pedido pode vir de qualquer navegador. Aqui a
// gente confere se veio uma sessão válida do painel (PDV/mesas) ou se é um
// cliente do site — o site nunca tem permissão de escolher preço, desconto etc.
async function isAuthed(req: Request): Promise<boolean> {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  if (!m) return false;
  try {
    await jose.jwtVerify(decodeURIComponent(m[1]), JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// Limite simples de pedidos por IP (em memória). Segura spam de pedidos falsos;
// em pico normal (alguns pedidos por minuto) ninguém é afetado.
const RL = new Map<string, number[]>();
function rateLimited(ip: string, max = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (RL.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  RL.set(ip, arr);
  if (RL.size > 2000) {
    for (const [k, v] of RL) if (!v.some((t) => now - t < windowMs)) RL.delete(k);
  }
  return arr.length > max;
}

// Recalcula o pedido do site com os preços do banco. O navegador manda o preço,
// mas quem manda no valor é o cadastro do produto (e do adicional).
async function validateSiteItems(raw: any): Promise<{ ok: true; items: any[] } | { ok: false; error: string }> {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) return { ok: false, error: 'Pedido sem itens' };
  if (list.length > 60) return { ok: false, error: 'Pedido com itens demais' };

  const ids = Array.from(new Set(list.map((i: any) => String(i?.productId || '')).filter(Boolean)));
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { groups: { include: { group: { include: { addons: true } } } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const items: any[] = [];
  for (const it of list) {
    const p = byId.get(String(it?.productId || ''));
    if (!p) return { ok: false, error: 'Um dos produtos não está mais disponível. Atualize a página e monte o pedido de novo.' };
    if (p.available === false) return { ok: false, error: `${p.name} está indisponível no momento.` };

    const allowed = new Map<string, any>();
    for (const g of p.groups) for (const a of g.group.addons) allowed.set(a.id, a);
    const addons = (Array.isArray(it?.addons) ? it.addons : []).slice(0, 20).map((a: any) => {
      const found = a?.id
        ? allowed.get(String(a.id))
        : Array.from(allowed.values()).find((x) => x.name === String(a?.name || ''));
      return {
        id: found?.id || String(a?.id || ''),
        name: found?.name || String(a?.name || 'Adicional'),
        price: Math.max(0, Number(found?.price ?? 0)),
        qty: Math.max(1, Math.min(20, Math.floor(Number(a?.qty || 1)))),
      };
    });

    items.push({
      productId: p.id,
      name: p.name,
      qty: Math.max(1, Math.min(99, Math.floor(Number(it?.qty || 1)))),
      unitPrice: Math.max(0, Number(p.promoPrice ?? p.price) || 0),
      addons,
      note: String(it?.note || '').slice(0, 200),
    });
  }
  return { ok: true, items };
}

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
  const qty = Math.max(1, Math.floor(Number(it.qty || 1)));
  const extra = addonsOf(it).reduce((s: number, a: any) => s + Math.max(0, Number(a.price || 0)) * Math.max(1, Number(a.qty || 1)), 0);
  return qty * (Math.max(0, Number(it.unitPrice || 0)) + extra);
}

// Mantem payments, string de pagamento e movimentos do caixa batendo com o total novo
// (devolve a string de pagamento final)
async function syncOrderMoney(orderId: string, number: number, total: number): Promise<string> {
  const ord = await prisma.order.findUnique({ where: { id: orderId } });
  if (!ord) return '';
  // caixa e pagamentos registram o valor da venda sem a taxa da maquininha
  const cashTotal = Math.max(0, Math.round((total - Number(ord.cardFee || 0)) * 100) / 100);
  let paymentStr = String(ord.payment || 'pix');
  const parts = parsePayments(paymentStr, cashTotal);
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

    // pedido único (usado na hora de imprimir/abrir um pedido específico)
    const id = searchParams.get('id');
    if (id) {
      const one = await prisma.order.findUnique({ where: { id }, include: { items: true, customer: true, table: true, driver: true } });
      if (!one) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
      return NextResponse.json(one);
    }

    const status = searchParams.get('status');
    const light = searchParams.get('light') === '1';
    const since = searchParams.get('since');
    const limit = Math.min(500, Math.max(1, Math.floor(Number(searchParams.get('limit') || 100)) || 100));

    const where: any = status && status !== 'all' ? { status } : {};
    if (since) {
      const d = new Date(since);
      if (!Number.isNaN(d.getTime())) where.updatedAt = { gt: d };
    }

    // O XML da nota é pesado e não é usado nas listas (o download busca em
    // /api/nfe). `light` devolve só o necessário para o painel avisar/imprimir.
    if (light) {
      const rows = await prisma.order.findMany({
        where,
        select: {
          id: true, number: true, status: true, source: true, type: true, customerName: true,
          createdAt: true, updatedAt: true, printCount: true, total: true, cardFee: true, payment: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return NextResponse.json(rows);
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true, customer: true, table: true, driver: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    // não manda o XML da nota na lista (é pesado; o download busca em /api/nfe)
    const enxuto = orders.map((o: any) => {
      const { nfeXml, nfePdfUrl, ...rest } = o;
      return rest;
    });
    return NextResponse.json(enxuto);
  } catch (e: any) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  const authed = await isAuthed(req);

  // removeItem / addItems / edit são ações do painel: exigem sessão válida.
  if (b.action && !authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Sem sessão = pedido do cardápio. O servidor decide a origem, aplica limite
  // por IP e recalcula os preços — o navegador não escolhe valor nem desconto.
  const orderSource = authed ? (b.source || 'cardapio') : 'cardapio';
  // o site só trabalha com entrega, retirada ou consumo no local; qualquer
  // outro tipo vindo de fora (ex.: "mesa") é ignorado para não furar taxa/caixa
  const orderType = authed
    ? (b.type || 'entrega')
    : (['entrega', 'retirada', 'local'].includes(String(b.type)) ? String(b.type) : 'entrega');
  if (!authed) {
    const ip = String(req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Muitos pedidos em sequência. Aguarde um minuto e tente de novo.' }, { status: 429 });
    }
    const val = await validateSiteItems(b.items);
    if (!val.ok) return NextResponse.json({ error: val.error }, { status: 400 });
    b.items = val.items;
    b.discount = 0;
    // mesa e motoboy só podem ser definidos pelo painel (o site não escolhe mesa)
    b.tableId = null;
    b.driverId = null;
    const met = String(b.payment || 'pix');
    b.payment = ['pix', 'dinheiro', 'debito', 'credito'].includes(met) ? met : 'pix';
  }

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
    const newTotal = Math.max(0, newSubtotal + (order.type === 'entrega' ? order.deliveryFee : 0) - order.discount + (order.cardFee || 0));
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
      orderId: order.id, productId: it.productId || '', name: it.name, qty: Math.max(1, Math.floor(Number(it.qty || 1))),
      unitPrice: Math.max(0, Number(it.unitPrice || 0)), addonsJson: JSON.stringify(it.addons || []), note: it.note || '',
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

    // devolve estoque dos itens antigos (estoque e auxiliar — nao pode derrubar a edicao)
    try {
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
    } catch {}

    // troca os itens atomicamente: ou apaga e recria tudo, ou nao mexe
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
      prisma.orderItem.createMany({ data: newItems.map((it: any) => ({ ...it, orderId: order.id })) }),
    ]);

    const subtotal = newItems.reduce((s: number, it: any) => s + lineTotal(it), 0);
    const type = b.type !== undefined ? String(b.type) : order.type;
    const fee = type === 'entrega' ? Number(b.deliveryFee ?? order.deliveryFee) : 0;
    const discount = Number(b.discount ?? order.discount);
    const cardFee = b.cardFee !== undefined ? Math.max(0, Number(b.cardFee) || 0) : Number(order.cardFee || 0);
    const total = Math.max(0, subtotal + fee - discount + cardFee);

    // cliente (relinka quando o telefone muda)
    let customerId = order.customerId ?? null;
    if (b.customerPhone !== undefined) {
      const phone = String(b.customerPhone || '').replace(/\D/g, '');
      if (phone) {
        let cust = await prisma.customer.findUnique({ where: { phone } }).catch(() => null);
        if (!cust) {
          cust = await prisma.customer.create({ data: { name: b.customerName || order.customerName || 'Cliente', phone } }).catch(() => null);
          if (!cust) cust = await prisma.customer.findUnique({ where: { phone } }).catch(() => null);
        }
        if (cust) customerId = cust.id;
      }
    }

    // CPF do cliente (opcional; quando informado vira destinatario da NFC-e — precisa ter 11 digitos)
    if (b.customerCpf !== undefined && String(b.customerCpf || '').replace(/\D/g, '').length === 11) {
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
      subtotal, deliveryFee: fee, discount, total, customerId, cardFee,
    };
    const updated = await prisma.order.update({ where: { id: order.id }, data, include: { items: true, customer: true, table: true, driver: true } });

    updated.payment = await syncOrderMoney(order.id, order.number, total);

    return NextResponse.json(updated);
  }

  // upsert cliente pelo telefone
  let customerId: string | undefined;

  // Preferências do restaurante: usadas no aceite automático, na taxa do cartão,
  // na taxa de entrega padrão e no pedido mínimo.
  const restPrefs = await prisma.restaurant
    .findUnique({
      where: { id: 'single' },
      select: { autoAccept: true, cardFeeCredit: true, cardFeeDebit: true, deliveryFee: true, minOrder: true },
    })
    .catch(() => null);

  const itemsIn = Array.isArray(b.items) ? b.items : [];
  const subtotal = itemsIn.length > 0 ? itemsIn.reduce((s: number, it: any) => s + lineTotal(it), 0) : Number(b.subtotal || 0);

  // pedido mínimo (só para o site; o PDV é o operador que decide)
  if (!authed && orderType === 'entrega') {
    const minOrder = Number(restPrefs?.minOrder || 0);
    if (minOrder > 0 && subtotal < minOrder) {
      return NextResponse.json(
        { error: `Pedido mínimo de R$ ${minOrder.toFixed(2).replace('.', ',')}` },
        { status: 400 },
      );
    }
  }

  // Bairros/taxas de entrega: servem para completar o cadastro e para conferir
  // a taxa cobrada no cardápio (o cliente não pode pagar a taxa de outro bairro).
  let zonas: { name: string; city: string; fee: number }[] = [];
  try {
    const settingAreas = await prisma.setting.findUnique({ where: { key: 'deliveryAreas' } });
    const areas = settingAreas ? (JSON.parse(settingAreas.value).areas || []) : [];
    zonas = (Array.isArray(areas) ? areas : [])
      .filter((a: any) => a && a.name && a.active !== false)
      .map((a: any) => ({ name: String(a.name), city: a.city || 'Santana do Livramento', fee: Number(a.fee) || 0 }));
  } catch {}
  // O site já manda rua/número/bairro prontos, mas quando o endereço foi digitado
  // à mão (ou vem de versões antigas do cardápio) só temos o texto completo.
  // Reaproveita o parser para o cadastro do cliente não ficar incompleto.
  if (b.addressText && String(b.type || '') === 'entrega' && (!b.street || !b.number)) {
    try {
      const parsed = parseAddress(String(b.addressText), zonas);
      if (!b.street && parsed.street) b.street = parsed.street;
      if (!b.number && parsed.number) b.number = parsed.number;
      if (!b.complement && parsed.complement) b.complement = parsed.complement;
      if (!b.district && parsed.district) b.district = parsed.district + (parsed.city ? `, ${parsed.city}` : '');
    } catch {}
  }
  if (b.customerPhone) {
    const phone = String(b.customerPhone).replace(/\D/g, '');
    const cpf = String(b.customerCpf || '').replace(/\D/g, '');
    const cpfOk = cpf.length === 11;
    let cust = await prisma.customer.findUnique({ where: { phone } }).catch(() => null);
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          name: b.customerName || 'Cliente', phone, cpf: cpfOk ? cpf : '',
          street: b.street || '', number: b.number || '', complement: b.complement || '',
          district: b.district || '', reference: b.reference || '',
        },
      }).catch(() => null);
      // corrida: outro pedido do mesmo telefone criou o cliente no mesmo instante
      if (!cust) cust = await prisma.customer.findUnique({ where: { phone } }).catch(() => null);
    } else {
      const updateData: any = { name: b.customerName || cust.name };
      if (cpfOk) updateData.cpf = cpf; // so preenche/atualiza quando informado (nao apaga)
      if (b.street) updateData.street = b.street;
      if (b.number) updateData.number = b.number;
      if (b.complement) updateData.complement = b.complement;
      if (b.district) updateData.district = b.district;
      await prisma.customer.update({ where: { id: cust.id }, data: updateData });
    }
    if (cust) customerId = cust.id;
  } else if (String(b.customerCpf || '').replace(/\D/g, '').length === 11) {
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
  // aceite automático: pedidos do cardápio já entram como confirmados, sem
  // precisar clicar em "Aceitar" no painel (PDV continua no fluxo do operador).
  const initialStatus = orderSource === 'cardapio' && restPrefs?.autoAccept ? 'confirmado' : 'novo';
  // taxa de entrega: no cardápio vale SEMPRE a taxa do bairro escolhido
  // (pagina antiga em cache mandava a taxa padrão do restaurante). Se o bairro
  // não estiver cadastrado, usa a taxa padrão do restaurante — nunca a que o
  // navegador mandou.
  let fee = orderType === 'entrega' ? Number(b.deliveryFee || 0) : 0;
  if (orderType === 'entrega' && orderSource === 'cardapio') {
    let zonaFee: number | null = null;
    if (zonas.length) {
      const p = parseAddress(String(b.addressText || ''), zonas);
      const zona = zonas.find((z) => z.name === p.district && (!p.city || z.city === p.city)) || zonas.find((z) => z.name === p.district);
      if (zona) zonaFee = zona.fee;
    }
    fee = zonaFee ?? (authed ? fee : Number(restPrefs?.deliveryFee ?? 0));
  }
  // taxa da maquininha: no cardápio o próprio servidor aplica a taxa configurada
  // em Configurações para não depender do que a página manda; no PDV vale o que
  // o operador marcou. Mesa do site paga no fechamento, então não entra aqui.
  const cardFeeCredit = Math.min(100, Math.max(0, Number(restPrefs?.cardFeeCredit ?? 3.9)));
  const cardFeeDebit = Math.min(100, Math.max(0, Number(restPrefs?.cardFeeDebit ?? 1.9)));
  const siteFeePct = orderSource === 'cardapio' && orderType !== 'mesa'
    ? (b.payment === 'credito' ? cardFeeCredit : b.payment === 'debito' ? cardFeeDebit : 0)
    : 0;
  const cardFee = orderSource === 'cardapio'
    ? (siteFeePct > 0 ? Math.round(Math.max(0, subtotal + fee - Number(b.discount || 0)) * siteFeePct) / 100 : 0)
    : Math.max(0, Number(b.cardFee || 0));
  const total = Math.max(0, subtotal + fee - Number(b.discount || 0) + cardFee);

  const turnoSetting = await prisma.setting.findUnique({ where: { key: 'turno_number' } });
  const turnoId = turnoSetting?.value || '1';

  // venda que ja entra no caixa junto com o pedido:
  //  - PDV (balcao/retirada/entrega/mesa): pago na hora, inclusive dividido
  //  - cardapio: pedido pago no site (mesa paga no fechamento da mesa)
  const cashAtCreation = orderSource === 'pdv' || (orderSource === 'cardapio' && orderType !== 'mesa');
  const cashTotal = Math.max(0, Math.round((total - cardFee) * 100) / 100);
  const cashParts = parsePayments(b.payment || 'pix', cashTotal);
  const cashReason = orderSource === 'pdv' ? 'PDV' : 'Pedido';

  // PDV (venda manual, paga na hora) nao pode ser lancado com o caixa fechado:
  // senao a venda existe mas o dinheiro nao entra no caixa. O site (cardapio)
  // continua aceitando pedido normalmente.
  if (orderSource === 'pdv') {
    const aberto = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' }, select: { id: true } });
    if (!aberto) {
      return NextResponse.json(
        { error: 'Caixa fechado — abra o caixa antes de finalizar a venda.', code: 'CASH_CLOSED' },
        { status: 409 },
      );
    }
  }

  // pedido + lancamento no caixa na MESMA requisicao: se o caixa nao receber
  // (dividido, conexao caindo, etc.) o pedido tambem nao e criado — nunca fica
  // venda no sistema sem o dinheiro no caixa.
  //
  // O numero do pedido e unico: se dois pedidos do site chegarem no mesmo
  // instante os dois leriam o mesmo "ultimo numero". Nesse caso o banco recusa
  // (P2002) e a transacao inteira volta — entao recalculamos o numero e
  // tentamos de novo, em vez de devolver erro pro cliente.
  let order: any;
  let cashRegisterOpen = true;
  for (let tentativa = 0; ; tentativa++) {
    const lastOrder = await prisma.order.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
    const seq = lastOrder ? lastOrder.number + 1 : 1;
    cashRegisterOpen = true;
    try {
      order = await prisma.$transaction(async (tx) => {
        const open = cashAtCreation
          ? await tx.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' } })
          : null;
        // corrida: o caixa pode ter sido fechado entre a checagem e a transacao
        if (cashAtCreation && !open && orderSource === 'pdv') throw new Error('CASH_CLOSED');
        const created = await tx.order.create({
          data: {
            number: seq,
            turnoId,
            customerId, customerName: b.customerName || '', customerPhone: b.customerPhone || '',
            addressText: b.addressText || '', type: orderType,
            status: initialStatus, payment: b.payment || 'pix', changeFor: b.changeFor ? Number(b.changeFor) : null,
            subtotal, deliveryFee: fee, discount: Number(b.discount || 0), cardFee,
            total, note: b.note || '', tableId: b.tableId || null, driverId: b.driverId || null,
            source: orderSource, emitRequested: !!b.emitRequested,
            items: { create: (b.items || []).map((it: any) => ({
              productId: it.productId || '', name: it.name, qty: Math.max(1, Math.floor(Number(it.qty || 1))),
              unitPrice: Math.max(0, Number(it.unitPrice || 0)), addonsJson: JSON.stringify(it.addons || []), note: it.note || '',
            })) },
            payments: { create: cashParts.map((p) => ({ method: p.method, amount: p.amount })) },
          },
          include: { items: true },
        });
        if (cashAtCreation) {
          if (!open) cashRegisterOpen = false;
          else {
            for (const p of cashParts) {
              await tx.cashMovement.create({
                data: { registerId: open.id, kind: 'venda', method: p.method, amount: p.amount, reason: `${cashReason} #${created.number}`, orderId: created.id },
              });
            }
          }
        }
        return created;
      });
      break;
    } catch (e: any) {
      if (String(e?.message || '') === 'CASH_CLOSED') {
        return NextResponse.json(
          { error: 'Caixa fechado — abra o caixa antes de finalizar a venda.', code: 'CASH_CLOSED' },
          { status: 409 },
        );
      }
      if (e?.code === 'P2002' && tentativa < 4) continue;
      throw e;
    }
  }
  await prisma.notification.create({ data: { kind: 'novo_pedido', text: `Novo pedido #${order.number} — ${order.customerName} — R$ ${total.toFixed(2)}` } });

  // Deduzir estoque de bebidas (produtos com inventoryItemId vinculado)
  for (const it of (b.items || [])) {
    if (!it.productId) continue;
    const prod = await prisma.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
    if (prod?.inventoryItemId) {
      await prisma.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { decrement: Number(it.qty || 1) } } });
    }
  }

  // pedidos de mesa (cardapio) pagam somente no fechamento da mesa (mesas/closeTable);
  // PDV e cardapio ja foram lancados no caixa na criacao (transacao acima)
  return NextResponse.json({ ...order, cashRegisterOpen });
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
  if (b.cardFee !== undefined) {
    const atual = await prisma.order.findUnique({ where: { id: b.id }, select: { subtotal: true, deliveryFee: true, discount: true } });
    if (atual) {
      const cardFee = Math.max(0, Number(b.cardFee) || 0);
      data.cardFee = cardFee;
      data.total = Math.max(0, atual.subtotal + atual.deliveryFee - atual.discount + cardFee);
    }
  }
  const order = await prisma.order.update({ where: { id: b.id }, data });
  // quando a forma de pagamento muda (ex.: fechamento de mesa), as parcelas
  // gravadas no pedido precisam acompanhar — senão o relatório por forma de
  // pagamento mostra a forma escolhida no site, não a que foi realmente paga.
  if (b.payment !== undefined) {
    const cashTotal = Math.max(0, Math.round((Number(order.total || 0) - Number(order.cardFee || 0)) * 100) / 100);
    const parts = parsePayments(String(order.payment || 'pix'), cashTotal);
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.createMany({ data: parts.map((p) => ({ orderId: order.id, method: p.method, amount: p.amount })) });
  }
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
