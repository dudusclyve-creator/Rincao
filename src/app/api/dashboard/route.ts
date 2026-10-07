import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
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
    const h = `${String(o.createdAt.getHours()).padStart(2,'0')}h`;
    byHour[h] = (byHour[h] || 0) + 1;
    const rawPay = String(o.payment || 'outro');
    if (rawPay.includes(',') || rawPay.includes(':')) {
      const parts = rawPay.split(',').map((s) => s.trim()).filter(Boolean);
      const parsed: { m: string; a: number }[] = [];
      for (const p of parts) {
        const i = p.lastIndexOf(':');
        if (i > 0) {
          const a = Number(p.slice(i + 1));
          if (Number.isFinite(a) && a > 0) { parsed.push({ m: p.slice(0, i), a: Math.round(a * 100) / 100 }); continue; }
        }
        parsed.push({ m: p, a: 0 });
      }
      const sum = parsed.reduce((s, x) => s + x.a, 0);
      let diff = Math.round((o.total - sum) * 100) / 100;
      if (diff < 0) {
        for (let i = parsed.length - 1; i >= 0 && diff < -0.005; i--) {
          const take = Math.min(parsed[i].a, Math.round(-diff * 100) / 100);
          parsed[i].a = Math.round((parsed[i].a - take) * 100) / 100;
          diff = Math.round((diff + take) * 100) / 100;
        }
      } else if (diff > 0.005 && parsed.length) {
        parsed[parsed.length - 1].a = Math.round((parsed[parsed.length - 1].a + diff) * 100) / 100;
      }
      parsed.forEach((x) => { if (x.a > 0) byPay[x.m] = (byPay[x.m] || 0) + x.a; });
    } else {
      byPay[rawPay] = (byPay[rawPay] || 0) + o.total;
    }
    o.items.forEach((it) => {
      prodCount[it.name] = prodCount[it.name] || { name: it.name, qty: 0, total: 0 };
      let extra = 0;
      try { extra = (JSON.parse(it.addonsJson || '[]') as any[]).reduce((s, a) => s + Number(a.price || 0) * Number(a.qty || 1), 0); } catch {}
      prodCount[it.name].qty += it.qty; prodCount[it.name].total += it.qty * (it.unitPrice + extra);
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
