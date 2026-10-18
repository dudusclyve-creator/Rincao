import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export async function GET() {
  const open = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, include: { movements: true }, orderBy: { openedAt: 'desc' } });
  const last = await prisma.cashRegister.findMany({ include: { movements: true }, orderBy: { openedAt: 'desc' }, take: 10 });
  const turno = await prisma.setting.upsert({ where: { key: 'turno_number' }, update: {}, create: { key: 'turno_number', value: '1' } });
  return NextResponse.json({ open, history: last, turno: Number(turno.value) });
}

// fecha todas as mesas em aberto (pedidos -> concluido, vendas -> caixa, mesa -> livre)
async function closeOpenTables(registerId: string, payment: string) {
  const tables = await prisma.tableMap.findMany({ where: { status: { in: ['ocupada', 'fechamento'] } }, orderBy: { number: 'asc' } });
  let closedTables = 0;
  let sales = 0;
  for (const t of tables) {
    const orders = await prisma.order.findMany({ where: { tableId: t.id, status: { notIn: ['concluido', 'cancelado'] } } });
    for (const o of orders) {
      await prisma.order.update({ where: { id: o.id }, data: { status: 'concluido', endedAt: new Date() } });
      if (o.source !== 'pdv') {
        await prisma.cashMovement.create({ data: { registerId, kind: 'venda', method: payment, amount: Number(o.total), orderId: o.id, reason: `${t.number} #${o.number}` } });
        sales += Number(o.total);
      }
    }
    await prisma.tableMap.update({ where: { id: t.id }, data: { status: 'livre' } });
    closedTables++;
  }
  return { closedTables, sales };
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
    const open = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' } });
    if (!open) return NextResponse.json({ error: 'Nenhum caixa aberto' }, { status: 400 });
    const tablePayment = ['dinheiro', 'pix', 'debito', 'credito'].includes(b.tablePayment) ? b.tablePayment : 'dinheiro';
    const closed = await closeOpenTables(open.id, tablePayment);
    const reg = await prisma.cashRegister.findUnique({ where: { id: open.id }, include: { movements: true } });
    const movements = reg?.movements || [];
    const vendas = movements.filter((m) => m.kind === 'venda').reduce((s, m) => s + m.amount, 0);
    const expected = open.initial + movements.reduce((s, m) => s + (['venda','entrada','suprimento'].includes(m.kind) ? m.amount : -m.amount), 0);
    const informed = Number(b.informed || 0);
    const r = await prisma.cashRegister.update({ where: { id: open.id }, data: { status: 'fechado', closedAt: new Date(), informed, expected } });
    if (closed.closedTables > 0) {
      await prisma.notification.create({ data: { kind: 'mesas', text: `${closed.closedTables} mesa(s) fechadas automaticamente no fechamento do caixa` } });
    }
    return NextResponse.json({ ...r, expected, informed, diff: informed - expected, vendas, movements, closedTables: closed.closedTables, closedTableSales: closed.sales });
  }
  if (b.action === 'new_turno') {
    const open = await prisma.cashRegister.findFirst({ where: { status: 'aberto' }, orderBy: { openedAt: 'desc' } });
    if (open) {
      await closeOpenTables(open.id, 'dinheiro');
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
