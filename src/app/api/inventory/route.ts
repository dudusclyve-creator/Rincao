import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export async function GET() {
  const items = await prisma.inventoryItem.findMany({ include: { movements: { orderBy: { createdAt: 'desc' }, take: 5 } } });
  return NextResponse.json(items);
}
export async function POST(req: Request) {
  const b = await req.json();
  if (b.action === 'create') return NextResponse.json(await prisma.inventoryItem.create({ data: { name: b.name, unit: b.unit || 'un', qty: Number(b.qty || 0), minQty: Number(b.minQty || 0) } }));
  if (b.action === 'move') {
    const item = await prisma.inventoryItem.findUnique({ where: { id: b.itemId } });
    if (!item) return NextResponse.json({ error: 'item?' }, { status: 404 });
    let qty = Number(b.qty);
    let newQty = b.kind === 'entrada' ? item.qty + qty : b.kind === 'saida' ? item.qty - qty : qty;
    await prisma.inventoryItem.update({ where: { id: b.itemId }, data: { qty: newQty } });
    return NextResponse.json(await prisma.inventoryMovement.create({ data: { itemId: b.itemId, kind: b.kind, qty, reason: b.reason || '' } }));
  }
  return NextResponse.json({ error: 'x' }, { status: 400 });
}
