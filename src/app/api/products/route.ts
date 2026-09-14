import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  return NextResponse.json(await prisma.product.findMany({ include: { category: true, groups: { include: { group: { include: { addons: true } } } } }, orderBy: { order: 'asc' } }));
}
export async function POST(req: Request) {
  const b = await req.json();
  const p = await prisma.product.create({ data: {
    name: b.name, description: b.description || '', price: Number(b.price), promoPrice: b.promoPrice ? Number(b.promoPrice) : null,
    photoUrl: b.photoUrl || '', categoryId: b.categoryId, available: b.available ?? true,
    featured: !!b.featured, bestSeller: !!b.bestSeller, order: Number(b.order || 0), relatedIds: JSON.stringify(b.relatedIds || []),
  }});
  if (b.groupIds?.length) for (const g of b.groupIds) { try { await prisma.productAddonGroup.create({ data: { productId: p.id, groupId: g } }); } catch {} }
  return NextResponse.json(p);
}
export async function PATCH(req: Request) {
  const b = await req.json();
  const p = await prisma.product.update({ where: { id: b.id }, data: {
    name: b.name, description: b.description, price: b.price !== undefined ? Number(b.price) : undefined,
    promoPrice: b.promoPrice === null ? null : b.promoPrice !== undefined ? Number(b.promoPrice) : undefined,
    photoUrl: b.photoUrl, categoryId: b.categoryId, available: b.available, featured: b.featured,
    bestSeller: b.bestSeller, order: b.order !== undefined ? Number(b.order) : undefined,
    relatedIds: b.relatedIds ? JSON.stringify(b.relatedIds) : undefined,
  }});
  if (b.groupIds) {
    await prisma.productAddonGroup.deleteMany({ where: { productId: b.id } });
    for (const g of b.groupIds) { try { await prisma.productAddonGroup.create({ data: { productId: b.id, groupId: g } }); } catch {} }
  }
  return NextResponse.json(p);
}
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id')!;
  const dup = searchParams.get('duplicate');
  if (dup) {
    const src = await prisma.product.findUnique({ where: { id }, include: { groups: true } });
    if (!src) return NextResponse.json({ error: 'N/A' }, { status: 404 });
    const np = await prisma.product.create({ data: { name: src.name + ' (cópia)', description: src.description, price: src.price, promoPrice: src.promoPrice, photoUrl: src.photoUrl, categoryId: src.categoryId, available: src.available, featured: false, bestSeller: false, relatedIds: src.relatedIds } });
    for (const g of src.groups) { try { await prisma.productAddonGroup.create({ data: { productId: np.id, groupId: g.groupId } }); } catch {} }
    return NextResponse.json(np);
  }
  await prisma.productAddonGroup.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
