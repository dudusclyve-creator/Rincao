import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

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

  // By payment method (usa os valores reais do dividir conta: "pix:20,dinheiro:30")
  const byPayment: Record<string, number> = {};
  active.forEach((o) => {
    const raw = String(o.payment || 'outro');
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const parsed: { m: string; a: number }[] = [];
    for (const p of parts) {
      const i = p.lastIndexOf(':');
      if (i > 0) {
        const a = Number(p.slice(i + 1));
        if (Number.isFinite(a) && a > 0) { parsed.push({ m: p.slice(0, i), a: Math.round(a * 100) / 100 }); continue; }
      }
      parsed.push({ m: p, a: 0 });
    }
    if (parsed.length === 1 && parsed[0].a === 0) {
      byPayment[parsed[0].m || 'outro'] = (byPayment[parsed[0].m || 'outro'] || 0) + o.total;
    } else {
      const sum = parsed.reduce((s, x) => s + x.a, 0);
      const diff = Math.round((o.total - sum) * 100) / 100;
      if (Math.abs(diff) > 0.005 && parsed.length) parsed[parsed.length - 1].a = Math.round((parsed[parsed.length - 1].a + diff) * 100) / 100;
      parsed.forEach((x) => { if (x.a > 0) byPayment[x.m] = (byPayment[x.m] || 0) + x.a; });
    }
  });

  // By type
  const byType: Record<string, { count: number; total: number }> = {};
  active.forEach((o) => {
    if (!byType[o.type]) byType[o.type] = { count: 0, total: 0 };
    byType[o.type].count++;
    byType[o.type].total += o.total;
  });

  // Top products (inclui adicionais)
  const prodMap: Record<string, { name: string; qty: number; total: number }> = {};
  active.forEach((o) => o.items.forEach((it) => {
    if (!prodMap[it.productId]) prodMap[it.productId] = { name: it.name, qty: 0, total: 0 };
    let extra = 0;
    try { extra = (JSON.parse(it.addonsJson || '[]') as any[]).reduce((s, a) => s + Number(a.price || 0) * Number(a.qty || 1), 0); } catch {}
    prodMap[it.productId].qty += it.qty;
    prodMap[it.productId].total += it.qty * (it.unitPrice + extra);
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
