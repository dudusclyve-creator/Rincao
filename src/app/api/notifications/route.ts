import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
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
