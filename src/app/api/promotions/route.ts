import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const promos = await prisma.promotion.findMany({ orderBy: { startAt: 'desc' } });
  return NextResponse.json(promos);
}

export async function POST(req: Request) {
  const b = await req.json();
  if (b.action === 'toggle') {
    const p = await prisma.promotion.update({ where: { id: b.id }, data: { active: b.active } });
    return NextResponse.json(p);
  }
  if (b.action === 'delete') {
    await prisma.promotion.delete({ where: { id: b.id } });
    return NextResponse.json({ ok: true });
  }
  const promo = await prisma.promotion.create({
    data: {
      title: b.title || 'Promoção',
      kind: b.kind || 'percent',
      value: Number(b.value || 0),
      productId: b.productId || '',
      startAt: b.startAt ? new Date(b.startAt) : new Date(),
      endAt: b.endAt ? new Date(b.endAt) : null,
      active: b.active !== false,
    },
  });
  return NextResponse.json(promo);
}
