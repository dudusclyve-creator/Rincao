import { prisma } from '@/lib/db';
import { cancelPixPayment, getPixConfig, syncPixOrder } from '@/lib/pix';

// Marca um pedido como pago na mao (conferencia humana): usado no botao
// "Marcar pago" de Pedidos e no PIX manual. Nao cria cobranca nenhuma e nao
// cobra taxa: registra o valor da venda no caixa aberto e fecha o pagamento.

export const MANUAL_METHODS = ['dinheiro', 'pix', 'debito', 'credito'];

export type MarkPaidResult = {
  ok: boolean;
  alreadyPaid?: boolean;
  amount?: number;
  number?: number;
  method?: string;
  error?: string;
  status?: number;
};

function saleValue(order: any) {
  return Math.round(Math.max(0, Number(order.subtotal || 0) + Number(order.deliveryFee || 0) - Number(order.discount || 0)) * 100) / 100;
}

export async function markOrderPaid(orderId: string, rawMethod: string): Promise<MarkPaidResult> {
  const method = MANUAL_METHODS.includes(String(rawMethod || '')) ? String(rawMethod) : '';
  const order = await prisma.order.findUnique({ where: { id: orderId } }).catch(() => null);
  if (!order) return { ok: false, error: 'Pedido nao encontrado', status: 404 };
  if (order.paidAt) return { ok: true, alreadyPaid: true, number: order.number, amount: Number(order.total || 0) };

  if (String(order.payment || '').includes(',')) {
    return { ok: false, error: 'Pedido com pagamento dividido — ajuste pelo Editar pedido', status: 400 };
  }

  const pay = method || (MANUAL_METHODS.includes(String(order.payment || '')) ? String(order.payment) : 'dinheiro');

  // confere o Mercado Pago antes: pode ter caido enquanto o operador olhava
  if (order.pixPaymentId) {
    const r = await syncPixOrder(order.id).catch(() => null);
    if (r?.status === 'approved') {
      return { ok: true, alreadyPaid: true, number: order.number, amount: Number(order.total || 0) };
    }
    const cfg = await getPixConfig(false, true).catch(() => null);
    if (cfg && order.pixPaymentId) await cancelPixPayment(cfg, order.pixPaymentId).catch(() => {});
  }

  // valor que entrou de verdade: sem a taxa do cartao (ela e da maquininha).
  // Se o pagamento nao e cartao, a taxa do cartao sai do pedido.
  const isCard = pay === 'debito' || pay === 'credito';
  const amount = Math.round(Math.max(0, isCard ? Number(order.total || 0) - Number(order.cardFee || 0) : saleValue(order)) * 100) / 100;
  const total = Math.round(Math.max(0, isCard ? Number(order.total || 0) : saleValue(order)) * 100) / 100;
  if (!(total > 0)) return { ok: false, error: 'Pedido sem valor', status: 400 };

  const rest = await prisma.restaurant.findUnique({ where: { id: 'single' }, select: { autoAccept: true } }).catch(() => null);
  const target = order.source === 'cardapio' && rest?.autoAccept ? 'confirmado' : 'novo';
  const reason = order.source === 'pdv' ? `PDV #${order.number}` : `Pedido #${order.number}`;
  const wasPending = ['aguardando_pagamento', 'cancelado'].includes(String(order.status || ''));
  const openNow = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' }, select: { id: true } });
  const open = openNow?.id ? openNow : (order.pixRegisterId ? { id: order.pixRegisterId } : null);

  let done = false;
  await prisma.$transaction(async (tx) => {
    const upd = await tx.order.updateMany({
      where: { id: order.id, paidAt: null },
      data: {
        paidAt: new Date(),
        payment: pay,
        cardFee: isCard ? Number(order.cardFee || 0) : 0,
        total,
        pixStatus: 'approved',
        pixQr: null,
        pixQrImage: null,
        pixExpiresAt: null,
        ...(wasPending ? { status: target } : {}),
      },
    });
    if (!upd.count) return;
    done = true;

    // pedido que nasceu aguardando pagamento (ou foi cancelado) nao baixou
    // o estoque de bebidas ainda
    if (wasPending) {
      const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { productId: true, qty: true } });
      for (const it of items) {
        if (!it.productId) continue;
        const prod = await tx.product.findUnique({ where: { id: it.productId }, select: { inventoryItemId: true } });
        if (prod?.inventoryItemId) {
          await tx.inventoryItem.update({ where: { id: prod.inventoryItemId }, data: { qty: { decrement: it.qty } } });
        }
      }
    }

    await tx.payment.deleteMany({ where: { orderId: order.id } });
    await tx.payment.create({ data: { orderId: order.id, method: pay, amount } });

    if (open?.id) {
      const inOpen = await tx.cashMovement.count({ where: { orderId: order.id, kind: 'venda', registerId: open.id } });
      const anywhere = await tx.cashMovement.count({ where: { orderId: order.id, kind: 'venda' } });
      if (inOpen > 0) {
        await tx.cashMovement.updateMany({ where: { orderId: order.id, kind: 'venda', registerId: open.id }, data: { method: pay, amount } });
      } else if (!anywhere) {
        await tx.cashMovement.create({ data: { registerId: open.id, kind: 'venda', method: pay, amount, reason, orderId: order.id } });
      }
    }

    if (order.tableId) {
      await tx.tableMap.update({ where: { id: order.tableId }, data: { status: 'ocupada' } }).catch(() => {});
    }

    await tx.notification.create({
      data: { kind: 'pagamento', text: `Pagamento confirmado manualmente (${pay}) — ${reason} — R$ ${amount.toFixed(2)}` },
    });
  });

  if (!done) return { ok: true, alreadyPaid: true, number: order.number, amount: Number(order.total || 0) };
  if (!open?.id) {
    await prisma.notification.create({
      data: { kind: 'pagamento', text: `Pagamento confirmado com o caixa fechado — ${reason} — R$ ${amount.toFixed(2)} (lancar manualmente)` },
    }).catch(() => {});
  }

  return { ok: true, amount, number: order.number, method: pay };
}

export function methodLabel(m: string) {
  return m === 'dinheiro' ? 'Dinheiro' : m === 'pix' ? 'PIX' : m === 'debito' ? 'Débito' : 'Crédito';
}
