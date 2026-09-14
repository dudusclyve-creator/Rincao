import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';
  const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' }, take: 500 });
  if (format === 'csv') {
    const head = 'numero;data;cliente;telefone;tipo;pagamento;status;total\n';
    const body = orders.map((o) => `${o.number};${o.createdAt.toISOString()};${o.customerName};${o.customerPhone};${o.type};${o.payment};${o.status};${o.total}`).join('\n');
    return new NextResponse(head + body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename=relatorio.csv' } });
  }
  return NextResponse.json(orders);
}
