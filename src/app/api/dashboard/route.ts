import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get('days') || 7);
  const since = new Date(); since.setDate(since.getDate() - days);
  const orders = await prisma.order.findMany({ where: { createdAt: { gte: since }, status: { not: 'cancelado' } }, include: { items: true } });
  const all = await prisma.order.findMany({ where: { createdAt: { gte: since } } });
  const vendas = orders.reduce((s, o) => s + o.total, 0);
  const byDay: Record<string, number> = {};
  const byPay: Record<string, number> = {};
  const byHour: Record<string, number> = {};
  const prodCount: Record<string, { name: string; qty: number; total: number }> = {};
  orders.forEach((o) => {
    const d = o.createdAt.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + o.total;
    if (o.payment?.includes(',')) {
      o.payment.split(',').forEach((part) => {
        const [method, amount] = part.split(':');
        byPay[method] = (byPay[method] || 0) + Number(amount);
      });
    } else {
      byPay[o.payment] = (byPay[o.payment] || 0) + o.total;
    }
    const h = `${String(o.createdAt.getHours()).padStart(2,'0')}h`;
    byHour[h] = (byHour[h] || 0) + 1;
    o.items.forEach((it) => {
      prodCount[it.name] = prodCount[it.name] || { name: it.name, qty: 0, total: 0 };
      prodCount[it.name].qty += it.qty; prodCount[it.name].total += it.qty * it.unitPrice;
    });
  });
  const today = new Date(); today.setHours(0,0,0,0);
  const todayOrders = all.filter((o) => o.createdAt >= today);
  return NextResponse.json({
    vendas, pedidos: orders.length, ticketMedio: orders.length ? vendas / orders.length : 0,
    pendentes: all.filter((o) => o.status === 'novo').length,
    preparo: all.filter((o) => o.status === 'preparo').length,
    concluidos: all.filter((o) => o.status === 'concluido').length,
    cancelados: all.filter((o) => o.status === 'cancelado').length,
    hoje: { vendas: todayOrders.filter((o) => o.status !== 'cancelado').reduce((s,o)=>s+o.total,0), pedidos: todayOrders.length },
    byDay, byPay, byHour,
    topProdutos: Object.values(prodCount).sort((a,b)=>b.qty-a.qty).slice(0,8),
  });
}
