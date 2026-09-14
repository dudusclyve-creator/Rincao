import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export async function GET() { return NextResponse.json(await prisma.review.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })); }
export async function POST(req: Request) {
  const b = await req.json();
  return NextResponse.json(await prisma.review.create({ data: { orderId: b.orderId || '', name: b.name || '', stars: Number(b.stars || 5), comment: b.comment || '' } }));
}
