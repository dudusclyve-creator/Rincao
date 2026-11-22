import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth';
import { markOrderPaid } from '@/lib/mark-paid';

// Marca qualquer pedido como pago (confirmacao humana no painel/PDV).
export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: 'Sessao expirada' }, { status: 401 });

  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 }); }
  const orderId = String(b?.orderId || '');
  if (!orderId) return NextResponse.json({ error: 'Pedido nao informado' }, { status: 400 });

  const r = await markOrderPaid(orderId, String(b?.payment || ''));
  if (!r.ok) return NextResponse.json({ error: r.error, ...r }, { status: r.status || 400 });
  return NextResponse.json(r);
}
