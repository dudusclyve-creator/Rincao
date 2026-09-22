import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); where.createdAt.lte = d; }
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  if (format === 'csv') {
    const head = 'numero;data;cliente;telefone;tipo;pagamento;status;subtotal;entrega;desconto;total\n';
    const body = orders.map((o) =>
      `${o.number};${o.createdAt.toISOString()};${o.customerName};${o.customerPhone};${o.type};${o.payment};${o.status};${o.subtotal};${o.deliveryFee};${o.discount};${o.total}`
    ).join('\n');
    return new NextResponse(head + body, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename=relatorio.csv' },
    });
  }

  const active = orders.filter((o) => o.status !== 'cancelado');
  const cancelled = orders.filter((o) => o.status === 'cancelado');
  const revenue = active.reduce((s, o) => s + o.total, 0);
  const avgTicket = active.length ? revenue / active.length : 0;

  // By payment method
  const byPayment: Record<string, number> = {};
  active.forEach((o) => {
    const methods = o.payment?.includes(',') ? o.payment.split(',').map((p: string) => p.split(':')[0]) : [o.payment || 'outro'];
    methods.forEach((m) => { byPayment[m] = (byPayment[m] || 0) + o.total / methods.length; });
  });

  // By type
  const byType: Record<string, { count: number; total: number }> = {};
  active.forEach((o) => {
    if (!byType[o.type]) byType[o.type] = { count: 0, total: 0 };
    byType[o.type].count++;
    byType[o.type].total += o.total;
  });

  // Top products
  const prodMap: Record<string, { name: string; qty: number; total: number }> = {};
  active.forEach((o) => o.items.forEach((it) => {
    if (!prodMap[it.productId]) prodMap[it.productId] = { name: it.name, qty: 0, total: 0 };
    prodMap[it.productId].qty += it.qty;
    prodMap[it.productId].total += it.qty * it.unitPrice;
  }));
  const topProducts = Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 10);

  // By day
  const byDay: Record<string, { count: number; total: number }> = {};
  active.forEach((o) => {
    const day = o.createdAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { count: 0, total: 0 };
    byDay[day].count++;
    byDay[day].total += o.total;
  });
  const dailyData = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));

  // By hour (peak hours)
  const byHour: Record<number, number> = {};
  active.forEach((o) => {
    const h = o.createdAt.getHours();
    byHour[h] = (byHour[h] || 0) + o.total;
  });

  return NextResponse.json({
    summary: { totalOrders: orders.length, activeOrders: active.length, cancelledOrders: cancelled.length, revenue, avgTicket },
    byPayment,
    byType,
    topProducts,
    dailyData,
    byHour,
    orders: orders.slice(0, 500),
  });
}
