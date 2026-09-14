import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: 'single' } });
  const categories = await prisma.category.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
  const products = await prisma.product.findMany({
    include: { category: true, groups: { include: { group: { include: { addons: true } } } } },
    orderBy: [{ order: 'asc' }],
  });
  return NextResponse.json({ restaurant, categories, products });
}
