import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export async function GET() { return NextResponse.json(await prisma.category.findMany({ orderBy: { order: 'asc' } })); }
export async function POST(req: Request) {
  const b = await req.json();
  return NextResponse.json(await prisma.category.create({ data: { name: b.name, order: Number(b.order || 0) } }));
}
export async function PATCH(req: Request) {
  const b = await req.json();
  return NextResponse.json(await prisma.category.update({ where: { id: b.id }, data: { name: b.name, order: b.order !== undefined ? Number(b.order) : undefined, active: b.active } }));
}
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')!;
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
