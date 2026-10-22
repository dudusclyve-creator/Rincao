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
  // Nova ordem (drag & drop): grava a posicao de todas de uma vez. Trocar apenas
  // "order" entre duas categorias falhava quando as duas tinham o mesmo numero.
  if (b.action === 'reorder' && Array.isArray(b.ids)) {
    await prisma.$transaction(
      b.ids.map((id: string, i: number) => prisma.category.update({ where: { id }, data: { order: i } }))
    );
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(await prisma.category.update({ where: { id: b.id }, data: { name: b.name, order: b.order !== undefined ? Number(b.order) : undefined, active: b.active } }));
}
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')!;
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
