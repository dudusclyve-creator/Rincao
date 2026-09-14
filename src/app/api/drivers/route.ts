import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export async function GET() { return NextResponse.json(await prisma.driver.findMany()); }
export async function POST(req: Request) {
  const b = await req.json();
  if (b.id && b.status) return NextResponse.json(await prisma.driver.update({ where: { id: b.id }, data: { status: b.status } }));
  return NextResponse.json(await prisma.driver.create({ data: { name: b.name, phone: b.phone || '' } }));
}
