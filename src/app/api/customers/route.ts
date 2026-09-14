import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') || '';
  const customers = await prisma.customer.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {},
    include: { orders: { orderBy: { createdAt: 'desc' }, take: 20 } },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  const enriched = customers.map((c) => ({
    ...c, orderCount: c.orders.length,
    totalSpent: c.orders.filter((o) => o.status !== 'cancelado').reduce((s, o) => s + o.total, 0),
    lastOrder: c.orders[0]?.createdAt || null,
    ticketMedio: c.orders.length ? c.orders.reduce((s, o) => s + o.total, 0) / c.orders.length : 0,
  }));
  return NextResponse.json(enriched);
}
