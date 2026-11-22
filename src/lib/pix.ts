import { prisma } from '@/lib/db';

// PIX automatico via Mercado Pago.
//
// O token fica na tabela Setting (chave "mercadoPago"), nunca na Restaurant —
// a Restaurant e lida publicamente pelo cardapio. Se o token nao estiver no
// banco, cai para a variavel de ambiente MERCADO_PAGO_ACCESS_TOKEN (app/Vercel).
//
// Fluxo: o pedido nasce com status "aguardando_pagamento" e sem lancamento no
// caixa. Quando o Mercado Pago confirma (webhook ou consulta), o pedido passa
// para novo/confirmado e a venda entra no caixa. Sem confirmacao, o pedido
// expira/cancela e nao entra em relatorio.

const MP_API = 'https://api.mercadopago.com';

export type PixConfig = { accessToken: string };

let cache: { at: number; cfg: PixConfig | null } = { at: 0, cfg: null };

export function resetPixCache() {
  cache = { at: 0, cfg: null };
}

export async function getPixConfig(force = false, ignoreEnabled = false): Promise<PixConfig | null> {
  if (!ignoreEnabled && !force && Date.now() - cache.at < 30_000) return cache.cfg;
  let cfg: PixConfig | null = null;
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'mercadoPago' } });
    const j = s ? JSON.parse(s.value) : null;
    const token = String(j?.accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
    if (token && (ignoreEnabled || j?.enabled !== false)) cfg = { accessToken: token };
  } catch {}
  if (!ignoreEnabled) cache = { at: Date.now(), cfg };
  return cfg;
}

export function pixWebhookUrl() {
  return String(process.env.PIX_WEBHOOK_URL || 'https://rincao.vercel.app/api/pix/webhook').trim();
}

function payerEmail(phone?: string) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 8 ? `cliente${d}@rincao.com.br` : 'pix@rincao.com.br';
}

async function mpFetch(cfg: PixConfig, path: string, init?: RequestInit) {
  const r = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!r.ok) {
    const msg = data?.message || data?.error || `Mercado Pago ${r.status}`;
    throw new Error(String(msg));
  }
  return data;
}

export interface PixCharge {
  id: string;
  status: string;
  qr: string;
  qrImage: string;
  ticketUrl: string;
}

export async function createPixCharge(cfg: PixConfig, opts: {
  amount: number;
  description: string;
  externalReference: string;
  payerPhone?: string;
  expiresInMinutes?: number;
}): Promise<PixCharge> {
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (!(amount > 0)) throw new Error('Valor do PIX invalido');
  const expires = new Date(Date.now() + (opts.expiresInMinutes ?? 30) * 60_000);
  const body: any = {
    transaction_amount: amount,
    description: String(opts.description || 'Pedido').slice(0, 250),
    payment_method_id: 'pix',
    external_reference: String(opts.externalReference),
    notification_url: pixWebhookUrl(),
    date_of_expiration: expires.toISOString(),
    payer: { email: payerEmail(opts.payerPhone), first_name: 'Cliente' },
  };
  const r = await mpFetch(cfg, '/v1/payments', {
    method: 'POST',
    // idempotencia: se a rede cair e o app repetir, o MP devolve a mesma cobranca
    headers: { 'X-Idempotency-Key': `${opts.externalReference}-${Date.now()}` },
    body: JSON.stringify(body),
  });
  const td = r?.point_of_interaction?.transaction_data || {};
  const qr = String(td.qr_code || '');
  if (!qr) throw new Error('Mercado Pago nao devolveu o codigo PIX');
  return {
    id: String(r.id || ''),
    status: String(r.status || 'pending'),
    qr,
    qrImage: String(td.qr_code_base64 || ''),
    ticketUrl: String(td.ticket_url || ''),
  };
}

export async function getPixPayment(cfg: PixConfig, id: string) {
  return mpFetch(cfg, `/v1/payments/${encodeURIComponent(id)}`);
}

// valida o token e devolve a conta (usado no botao "Salvar token" do painel)
export async function getMpAccount(accessToken: string) {
  const token = String(accessToken || '').trim();
  if (!token) throw new Error('Informe o Access Token');
  const r = await fetch(`${MP_API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!r.ok) {
    throw new Error(r.status === 401 || r.status === 403 ? 'Token inválido ou sem permissão' : `Mercado Pago ${r.status}`);
  }
  const j: any = await r.json();
  return {
    id: String(j?.id || ''),
    nickname: String(j?.nickname || ''),
    email: String(j?.email || ''),
  };
}

export async function cancelPixPayment(cfg: PixConfig, id: string) {
  try {
    return await mpFetch(cfg, `/v1/payments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    });
  } catch {
    return null;
  }
}

// PDV: o cliente desistiu do PIX na hora e vai pagar de outro jeito. Cancela a
// cobranca no Mercado Pago e fecha a MESMA venda no metodo escolhido (o pedido
// ja existe aguardando pagamento, entao o numero nao muda e nao fica buraco).
export async function switchPixPayment(orderId: string, method: string) {
  const pay = String(method || '');
  if (!['dinheiro', 'debito', 'credito'].includes(pay)) throw new Error('Forma de pagamento invalida');
  const order = await prisma.order.findUnique({ where: { id: orderId } }).catch(() => null);
  if (!order) throw new Error('Pedido nao encontrado');
  if (order.paidAt) throw new Error('Este PIX ja foi pago — a venda ja esta confirmada');
  if (String(order.payment || '') !== 'pix') throw new Error('Este pedido nao esta no PIX');
  if (String(order.status) !== 'aguardando_pagamento') throw new Error('Pedido nao esta aguardando pagamento');

  // confere no banco antes de cancelar: o cliente pode ter pago no ultimo segundo
  const cfg = await getPixConfig(false, true);
  if (cfg && order.pixPaymentId) {
    const mp = await getPixPayment(cfg, order.pixPaymentId).catch(() => null);
    if (['approved', 'authorized'].includes(String(mp?.status || ''))) {
      await syncPixOrder(order.id).catch(() => {});
      throw new Error('O cliente acabou de pagar o PIX — venda confirmada automaticamente');
    }
    await cancelPixPayment(cfg, order.pixPaymentId);
  }

  const rest = await prisma.restaurant.findUnique({
    where: { id: 'single' },
    select: { autoAccept: true, cardFeeCredit: true, cardFeeDebit: true },
  }).catch(() => null);
  const pct = pay === 'credito'
    ? Number(rest?.cardFeeCredit ?? 3.9)
    : pay === 'debito' ? Number(rest?.cardFeeDebit ?? 1.9) : 0;
  const base = Math.max(0, Number(order.total || 0) - Number(order.cardFee || 0));
  const fee = pct > 0 ? Math.round(base * pct) / 100 : 0;
  const total = Math.round((base + fee) * 100) / 100;
  const target = order.source === 'cardapio' && rest?.autoAccept ? 'confirmado' : 'novo';
  const label = pay === 'dinheiro' ? 'dinheiro' : pay === 'credito' ? 'credito' : 'debito';
  const reason = order.source === 'pdv' ? `PDV #${order.number}` : `Pedido #${order.number}`;
  const openNow = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' }, select: { id: true } });
  const open = openNow?.id ? openNow : (order.pixRegisterId ? { id: order.pixRegisterId } : null);

  await prisma.$transaction(async (tx) => {
    const upd = await tx.order.updateMany({
      where: { id: order.id, paidAt: null },
      data: {
        payment: pay, total, cardFee: fee, status: target,
        pixStatus: 'cancelled', pixQr: null, pixQrImage: null, pixExpiresAt: null,
      },
    });
    if (!upd.count) throw new Error('O pedido mudou enquanto trocava — confira em Pedidos');
    // bebidas com estoque vinculado: pedido PIX nasce sem baixa, entao baixa agora
    const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { productId: true, qty: true } });
    for (const it of items) {
      if (!it.productId) continue;
      const prod = await tx.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
      if (prod?.inventoryItemId) {
        await tx.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { decrement: it.qty } } });
      }
    }
    if (open?.id && total > 0) {
      const jaLancado = await tx.cashMovement.count({ where: { orderId: order.id, kind: 'venda' } });
      if (!jaLancado) {
        await tx.cashMovement.create({ data: { registerId: open.id, kind: 'venda', method: pay, amount: total, reason, orderId: order.id } });
      }
    }
    if (order.tableId) {
      await tx.tableMap.update({ where: { id: order.tableId }, data: { status: 'ocupada' } }).catch(() => {});
    }
    await tx.notification.create({
      data: {
        kind: 'pagamento',
        text: `PIX cancelado no PDV — ${reason} pago em ${label}${fee > 0 ? ` (taxa ${pct}% R$ ${fee.toFixed(2)})` : ''} — R$ ${total.toFixed(2)}`,
      },
    });
  });

  if (!open?.id && total > 0) {
    await prisma.notification.create({
      data: { kind: 'pagamento', text: `Venda em ${label} com o caixa fechado — ${reason} — R$ ${total.toFixed(2)} (lancar manualmente)` },
    }).catch(() => {});
  }

  return { ok: true, payment: pay, total, cardFee: fee, pct };
}

function cashAmountOf(order: any) {
  // a taxa da maquininha nao existe no PIX; ainda assim, se houver, nao entra no caixa
  return Math.max(0, Math.round((Number(order.total || 0) - Number(order.cardFee || 0)) * 100) / 100);
}

async function approveOrder(order: any, mp?: any) {
  const rest = await prisma.restaurant.findUnique({ where: { id: 'single' }, select: { autoAccept: true } }).catch(() => null);
  const target = order.source === 'cardapio' && rest?.autoAccept ? 'confirmado' : 'novo';
  const reason = order.source === 'pdv' ? `PDV #${order.number}` : `Pedido #${order.number}`;
  const amount = cashAmountOf(order);
  // pedido que ja tinha saido da tela (cancelado/expirado) e foi pago depois:
  // o dinheiro entrou, entao reabre com aviso em vez de sumir do caixa
  const reopened = !['aguardando_pagamento', 'novo', 'confirmado', 'preparo', 'pronto', 'saiu', 'concluido'].includes(String(order.status || ''));
  // caixa: prioriza o que esta aberto agora (pagamento pode cair depois de um
  // fechamento); se nao houver nenhum, usa o caixa de quando o QR foi gerado
  const openNow = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' }, select: { id: true } });
  const open = openNow?.id ? openNow : (order.pixRegisterId ? { id: order.pixRegisterId } : null);

  // taxa que o Mercado Pago desconta do PIX (aparece no extrato da conta, nao no
  // valor do cliente). Lanca como saida no caixa para o fechamento bater.
  const mpFee = (() => {
    const gross = Number(mp?.transaction_amount ?? order.total ?? 0);
    const details = Array.isArray(mp?.fee_details) ? mp.fee_details : [];
    const sum = details.reduce((s: number, d: any) => s + (Number(d?.amount) || 0), 0);
    const net = Number(mp?.transaction_details?.net_received_amount);
    const fee = sum > 0 ? sum : (Number.isFinite(net) && gross > net ? gross - net : 0);
    return Math.round(Math.max(0, fee) * 100) / 100;
  })();

  await prisma.$transaction(async (tx) => {
    // updateMany garante que webhook + consulta ao mesmo tempo confirmem so uma vez
    const upd = await tx.order.updateMany({
      where: { id: order.id, paidAt: null },
      data: {
        paidAt: new Date(),
        pixStatus: 'approved',
        ...(order.status === 'aguardando_pagamento' || reopened ? { status: target } : {}),
      },
    });
    if (!upd.count) return;
    // bebidas com estoque vinculado: desconta so agora (pedido PIX nasce sem baixa)
    const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { productId: true, qty: true } });
    for (const it of items) {
      if (!it.productId) continue;
      const prod = await tx.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
      if (prod?.inventoryItemId) {
        await tx.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { decrement: it.qty } } });
      }
    }
    if (open?.id && amount > 0) {
      // se a mesa/pedido ja tinha sido lancado no caixa (ex.: mesa fechada antes
      // do webhook chegar), nao lanca de novo
      const jaLancado = await tx.cashMovement.count({ where: { orderId: order.id, kind: 'venda' } });
      if (!jaLancado) {
        await tx.cashMovement.create({
          data: { registerId: open.id, kind: 'venda', method: 'pix', amount, reason, orderId: order.id },
        });
      }
    }
    // taxa do Mercado Pago (R$ 0,06 no PIX de R$ 6,00, por exemplo): sai do
    // valor recebido no banco, por isso entra como saida separada
    if (open?.id && mpFee > 0) {
      await tx.cashMovement.create({
        data: { registerId: open.id, kind: 'taxa', method: 'pix', amount: mpFee, reason: `Taxa Mercado Pago - ${reason}`, orderId: order.id },
      });
    }
    await tx.notification.create({
      data: {
        kind: 'pagamento',
        text: reopened
          ? `PIX pago DEPOIS do pedido ser cancelado/expirado — ${reason} — R$ ${amount.toFixed(2)} (pedido reaberto, confira)`
          : `PIX confirmado — ${reason} — R$ ${amount.toFixed(2)}`,
      },
    });
    // mesa do PDV: so ocupa a mesa depois que o pagamento caiu
    if (order.tableId) {
      await tx.tableMap.update({ where: { id: order.tableId }, data: { status: 'ocupada' } }).catch(() => {});
    }
  });

  if (!open?.id && amount > 0) {
    await prisma.notification.create({
      data: { kind: 'pagamento', text: `PIX confirmado com o caixa fechado — ${reason} — R$ ${amount.toFixed(2)} (lancar manualmente)` },
    }).catch(() => {});
  }
}

export type PixOrderStatus = 'pending' | 'approved' | 'cancelled' | 'expired' | 'none';

// Consulta o Mercado Pago e aplica o resultado no pedido. Usado pelo webhook e
// pelo polling do cardapio/PDV (funciona tambem no app portatil: o banco e o
// mesmo do site, entao a confirmacao chega por qualquer um dos dois).
export async function syncPixOrder(orderId: string): Promise<{ status: PixOrderStatus; order: any }> {
  // ignora o "desligado": cobranca ja gerada precisa continuar confirmando
  const cfg = await getPixConfig(false, true);
  const order = await prisma.order.findUnique({ where: { id: orderId } }).catch(() => null);
  if (!order) return { status: 'none', order: null };
  if (order.paidAt) return { status: 'approved', order };
  if (!cfg || !order.pixPaymentId) return { status: 'none', order };

  try {
    const p = await getPixPayment(cfg, order.pixPaymentId);
    const st = String(p?.status || '').toLowerCase();

    if (st === 'approved') {
      await approveOrder(order, p);
      return { status: 'approved', order };
    }

    if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(st)) {
      await prisma.order.updateMany({
        where: { id: order.id, paidAt: null },
        data: { pixStatus: 'cancelled', ...(order.status === 'aguardando_pagamento' ? { status: 'cancelado' } : {}) },
      });
      return { status: 'cancelled', order };
    }

    // o MP pode manter "pending" depois do vencimento: encerra pela nossa data
    if (order.pixExpiresAt && new Date(order.pixExpiresAt).getTime() < Date.now() - 60_000) {
      await prisma.order.updateMany({
        where: { id: order.id, paidAt: null },
        data: { pixStatus: 'expired', ...(order.status === 'aguardando_pagamento' ? { status: 'cancelado' } : {}) },
      });
      return { status: 'expired', order };
    }

    return { status: 'pending', order };
  } catch {
    // rede/MP fora do ar: mantem pendente e tenta de novo no proximo poll
    return { status: (order.pixStatus as PixOrderStatus) || 'pending', order };
  }
}

// limpeza leve: pedidos PIX que ficaram aguardando e venceram saem do relatorio
export async function sweepExpiredPix() {
  try {
    await prisma.order.updateMany({
      where: {
        status: 'aguardando_pagamento',
        paidAt: null,
        pixExpiresAt: { lt: new Date(Date.now() - 5 * 60_000) },
      },
      data: { status: 'cancelado', pixStatus: 'expired' },
    });
  } catch {}
}
