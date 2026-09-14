import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export async function GET() { return NextResponse.json(await prisma.coupon.findMany({ orderBy: { code: 'asc' } })); }
export async function POST(req: Request) {
  const b = await req.json();
  return NextResponse.json(await prisma.coupon.create({ data: {
    code: String(b.code).toUpperCase().trim(), kind: b.kind || 'percent', value: Number(b.value || 0),
    minValue: Number(b.minValue || 0), maxUses: Number(b.maxUses || 100),
    expiresAt: b.expiresAt ? new Date(b.expiresAt) : null, firstOnly: !!b.firstOnly, phoneOnly: b.phoneOnly || '', active: true,
  }}));
}
export async function PATCH(req: Request) {
  const b = await req.json();
  return NextResponse.json(await prisma.coupon.update({ where: { id: b.id }, data: { active: b.active, maxUses: b.maxUses !== undefined ? Number(b.maxUses) : undefined } }));
}
export async function DELETE(req: Request) {
  await prisma.coupon.delete({ where: { id: new URL(req.url).searchParams.get('id')! } });
  return NextResponse.json({ ok: true });
}
