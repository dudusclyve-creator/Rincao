import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

// limpeza leve: no máximo 1x a cada 6h, apaga notificações lidas com mais de
// 7 dias e mantém as 500 mais recentes (a tabela crescia sem limite).
let lastPrune = 0;
async function pruneNotifications() {
  if (Date.now() - lastPrune < 6 * 60 * 60 * 1000) return;
  lastPrune = Date.now();
  try {
    await prisma.notification.deleteMany({
      where: { read: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    const total = await prisma.notification.count();
    if (total > 500) {
      const keep = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 500, select: { id: true } });
      await prisma.notification.deleteMany({ where: { id: { notIn: keep.map((k) => k.id) } } });
    }
  } catch {}
}

export async function GET() {
  try {
    await pruneNotifications();
    const rows = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (b.action === 'read') {
      await prisma.notification.updateMany({ where: { id: { in: b.ids || [] } }, data: { read: true } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'acao invalida' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'erro' }, { status: 500 });
  }
}
