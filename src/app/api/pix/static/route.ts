import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { staticPixPayload } from '@/lib/pix-static';

// PIX manual do painel (Pedidos): gera um "copia e cola" normal, com o valor do
// pedido, direto na chave da loja. Sem Mercado Pago, sem taxa e sem webhook.
// A confirmacao do recebimento fica com o operador (POST /api/orders/paid).

function orderValue(order: any) {
  return Math.round(Math.max(0, Number(order.subtotal || 0) + Number(order.deliveryFee || 0) - Number(order.discount || 0)) * 100) / 100;
}

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: 'Sessao expirada' }, { status: 401 });

  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 }); }
  const orderId = String(b?.orderId || '');
  if (!orderId) return NextResponse.json({ error: 'Pedido nao informado' }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId } }).catch(() => null);
  if (!order) return NextResponse.json({ error: 'Pedido nao encontrado' }, { status: 404 });
  if (order.paidAt) return NextResponse.json({ error: 'Pedido ja pago', status: 'approved' }, { status: 409 });
  if (String(order.payment || '').includes(',')) {
    return NextResponse.json({ error: 'Pedido com pagamento dividido — use o PDV' }, { status: 400 });
  }

  const rest = await prisma.restaurant.findUnique({ where: { id: 'single' } }).catch(() => null);
  const key = String(rest?.pixKey || '').trim();
  if (!key) return NextResponse.json({ error: 'Cadastre a chave PIX em Configuracoes' }, { status: 400 });

  const amount = orderValue(order);
  if (!(amount > 0)) return NextResponse.json({ error: 'Pedido sem valor' }, { status: 400 });

  let payload = '';
  try {
    payload = staticPixPayload({
      key,
      amount,
      merchant: rest?.name || 'RINCAO LANCHES',
      city: rest?.address,
      txid: `PEDIDO${order.number}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Nao foi possivel gerar o PIX' }, { status: 400 });
  }

  return NextResponse.json({
    orderId: order.id,
    number: order.number,
    total: amount,
    payload,
    key,
    merchant: rest?.name || 'Rincao Lanches',
  });
}
