import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') || '';
  const customers = await prisma.customer.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {},
    include: { orders: { orderBy: { createdAt: 'desc' }, include: { items: true } } },
    orderBy: { createdAt: 'desc' }, take: 200,
  });
  const enriched = customers.map((c) => {
    const validOrders = c.orders.filter((o) => o.status !== 'cancelado');
    const totalSpent = validOrders.reduce((s, o) => s + o.total, 0);
    const orderCount = validOrders.length;
    const freqMap: Record<string, number> = {};
    validOrders.forEach((o) => { o.items.forEach((it) => { freqMap[it.name] = (freqMap[it.name] || 0) + it.qty; }); });
    const favProducts = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, qty]) => ({ name, qty }));
    const last5 = validOrders.slice(0, 5);
    const daysBetween = validOrders.length >= 2 ? (new Date(validOrders[0].createdAt).getTime() - new Date(validOrders[validOrders.length - 1].createdAt).getTime()) / (1000 * 60 * 60 * 24) : 0;
    const avgDaysBetween = orderCount >= 2 && daysBetween > 0 ? daysBetween / (orderCount - 1) : null;
    const daysSinceLast = validOrders.length ? (Date.now() - new Date(validOrders[0].createdAt).getTime()) / (1000 * 60 * 60 * 24) : null;
    let tier = 'novo';
    if (orderCount >= 20 || totalSpent >= 1000) tier = 'vip';
    else if (orderCount >= 5 || totalSpent >= 200) tier = 'regular';
    else if (orderCount >= 2) tier = 'recorrente';
    return {
      id: c.id, name: c.name, phone: c.phone, street: c.street, number: c.number, district: c.district, complement: c.complement,
      createdAt: c.createdAt, orderCount, totalSpent, lastOrder: c.orders[0]?.createdAt || null,
      ticketMedio: orderCount ? totalSpent / orderCount : 0,
      favProducts, last5Orders: last5.map((o) => ({ number: o.number, total: o.total, date: o.createdAt, type: o.type, payment: o.payment })),
      avgDaysBetween: avgDaysBetween ? Math.round(avgDaysBetween) : null,
      daysSinceLast: daysSinceLast !== null ? Math.round(daysSinceLast) : null,
      tier,
    };
  });
  const totalClients = enriched.length;
  const totalRevenue = enriched.reduce((s, c) => s + c.totalSpent, 0);
  const avgTicket = totalClients ? totalRevenue / enriched.filter((c) => c.orderCount > 0).length : 0;
  const vipCount = enriched.filter((c) => c.tier === 'vip').length;
  return NextResponse.json({ customers: enriched, stats: { totalClients, totalRevenue, avgTicket, vipCount } });
}
