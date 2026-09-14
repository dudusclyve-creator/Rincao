import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export async function GET() { return NextResponse.json(await prisma.tableMap.findMany({ orderBy: { number: 'asc' } })); }
export async function POST(req: Request) {
  const b = await req.json();
  if (b.action === 'create') return NextResponse.json(await prisma.tableMap.create({ data: { number: b.number } }));
  if (b.action === 'status') return NextResponse.json(await prisma.tableMap.update({ where: { id: b.id }, data: { status: b.status } }));
  return NextResponse.json({ error: 'x' }, { status: 400 });
}
