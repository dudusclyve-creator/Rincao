import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export async function GET() {
  const open = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, include: { movements: true }, orderBy: { openedAt: 'desc' } });
  const last = await prisma.cashRegister.findMany({ include: { movements: true }, orderBy: { openedAt: 'desc' }, take: 10 });
  const turno = await prisma.setting.upsert({ where: { key: 'turno_number' }, update: {}, create: { key: 'turno_number', value: '1' } });
  return NextResponse.json({ open, history: last, turno: Number(turno.value) });
}
export async function POST(req: Request) {
  const b = await req.json();
  if (b.action === 'open') {
    const r = await prisma.cashRegister.create({ data: { operator: b.operator, openedBy: b.operator, initial: Number(b.initial || 0) } });
    await prisma.notification.create({ data: { kind: 'caixa', text: `Caixa aberto por ${b.operator}` } });
    return NextResponse.json(r);
  }
  if (b.action === 'movement') {
    const open = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' } });
    if (!open) return NextResponse.json({ error: 'Nenhum caixa aberto' }, { status: 400 });
    const m = await prisma.cashMovement.create({ data: { registerId: open.id, kind: b.kind, method: b.method || 'dinheiro', amount: Number(b.amount), reason: b.reason || '', orderId: b.orderId || '' } });
    return NextResponse.json(m);
  }
  if (b.action === 'close') {
    const open = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, include: { movements: true }, orderBy: { openedAt: 'desc' } });
    if (!open) return NextResponse.json({ error: 'Nenhum caixa aberto' }, { status: 400 });
    const vendas = open.movements.filter((m) => m.kind === 'venda').reduce((s, m) => s + m.amount, 0);
    const expected = open.initial + open.movements.reduce((s, m) => s + (['venda','entrada','suprimento'].includes(m.kind) ? m.amount : -m.amount), 0);
    const informed = Number(b.informed || 0);
    const r = await prisma.cashRegister.update({ where: { id: open.id }, data: { status: 'fechado', closedAt: new Date(), informed, expected } });
    return NextResponse.json({ ...r, expected, informed, diff: informed - expected, vendas });
  }
  if (b.action === 'new_turno') {
    const open = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, include: { movements: true }, orderBy: { openedAt: 'desc' } });
    if (open) {
      await prisma.cashRegister.update({ where: { id: open.id }, data: { status: 'fechado', closedAt: new Date(), informed: 0, expected: 0 } });
    }
    const turno = await prisma.setting.findUnique({ where: { key: 'turno_number' } });
    const nextTurno = (Number(turno?.value || 1)) + 1;
    await prisma.setting.upsert({ where: { key: 'turno_number' }, update: { value: String(nextTurno) }, create: { key: 'turno_number', value: String(nextTurno) } });
    await prisma.notification.create({ data: { kind: 'turno', text: `Novo turno #${nextTurno} iniciado` } });
    return NextResponse.json({ turno: nextTurno });
  }
  return NextResponse.json({ error: 'acao invalida' }, { status: 400 });
}
