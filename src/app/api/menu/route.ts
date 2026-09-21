import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: 'single' } });
  const categories = await prisma.category.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
  const products = await prisma.product.findMany({
    include: { category: true, groups: { include: { group: { include: { addons: true } } } } },
    orderBy: [{ order: 'asc' }],
  });

  // Active promotions
  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: {
      active: true,
      startAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gte: now } }],
    },
  });

  // Apply promotions to products
  const promoProducts: Record<string, { kind: string; value: number; title: string }> = {};
  for (const p of promos) {
    if (p.productId && p.kind === 'produto') {
      promoProducts[p.productId] = { kind: 'produto', value: p.value, title: p.title };
    }
  }

  const enriched = products.map((p) => {
    const promo = promoProducts[p.id];
    let promoPrice = p.promoPrice;
    if (promo) {
      promoPrice = promo.kind === 'percent' ? p.price * (1 - promo.value / 100) : p.price - promo.value;
      promoPrice = Math.max(0, promoPrice);
    }
    return { ...p, promoPrice, promoTitle: promo?.title };
  });

  return NextResponse.json({ restaurant, categories, products: enriched, promos });
}
