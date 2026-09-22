import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export async function GET() {
  return NextResponse.json(await prisma.addonGroup.findMany({ include: { addons: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } }));
}
export async function POST(req: Request) {
  const b = await req.json();
  if (b.addon) {
    return NextResponse.json(await prisma.addon.create({ data: { groupId: b.groupId, name: b.addon.name, price: Number(b.addon.price || 0), order: Number(b.addon.order || 0) } }));
  }
  return NextResponse.json(await prisma.addonGroup.create({ data: { name: b.name, minSel: Number(b.minSel || 0), maxSel: Number(b.maxSel || 1), required: !!b.required, order: Number(b.order || 0) } }));
}
export async function PATCH(req: Request) {
  const b = await req.json();
  if (b.addonId) return NextResponse.json(await prisma.addon.update({ where: { id: b.addonId }, data: { name: b.name, price: b.price !== undefined ? Number(b.price) : undefined, active: b.active, order: b.order !== undefined ? Number(b.order) : undefined } }));
  return NextResponse.json(await prisma.addonGroup.update({ where: { id: b.id }, data: { name: b.name, minSel: b.minSel !== undefined ? Number(b.minSel) : undefined, maxSel: b.maxSel !== undefined ? Number(b.maxSel) : undefined, required: b.required, order: b.order !== undefined ? Number(b.order) : undefined } }));
}
export async function DELETE(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get('addonId')) { await prisma.addon.delete({ where: { id: u.searchParams.get('addonId')! } }); }
  else { await prisma.addonGroup.delete({ where: { id: u.searchParams.get('id')! } }); }
  return NextResponse.json({ ok: true });
}
