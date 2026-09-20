import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const drivers = await prisma.driver.findMany({ orderBy: { name: 'asc' } });
  // Remove duplicates by name
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const d of drivers) {
    const key = d.name.trim().toLowerCase();
    if (seen.has(key)) {
      duplicates.push(d.id);
    } else {
      seen.set(key, d.id);
    }
  }
  if (duplicates.length > 0) {
    await prisma.driver.deleteMany({ where: { id: { in: duplicates } } });
    return NextResponse.json(await prisma.driver.findMany({ orderBy: { name: 'asc' } }));
  }
  return NextResponse.json(drivers);
}

export async function POST(req: Request) {
  const b = await req.json();
  if (b.id && b.status) {
    return NextResponse.json(await prisma.driver.update({ where: { id: b.id }, data: { status: b.status } }));
  }
  if (b.id && b.name) {
    return NextResponse.json(await prisma.driver.update({ where: { id: b.id }, data: { name: b.name, phone: b.phone || '' } }));
  }
  // Check for duplicate name
  const existing = await prisma.driver.findFirst({ where: { name: b.name } });
  if (existing) {
    return NextResponse.json(existing);
  }
  return NextResponse.json(await prisma.driver.create({ data: { name: b.name, phone: b.phone || '' } }));
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.driver.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
