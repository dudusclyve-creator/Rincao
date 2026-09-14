import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  const { code, subtotal, phone } = await req.json();
  const cp = await prisma.coupon.findUnique({ where: { code: String(code || '').toUpperCase().trim() } });
  if (!cp || !cp.active) return NextResponse.json({ ok: false, error: 'Cupom inválido' });
  if (cp.expiresAt && cp.expiresAt < new Date()) return NextResponse.json({ ok: false, error: 'Cupom expirado' });
  if (cp.used >= cp.maxUses) return NextResponse.json({ ok: false, error: 'Limite de uso atingido' });
  if (Number(subtotal || 0) < cp.minValue) return NextResponse.json({ ok: false, error: `Pedido mínimo de R$ ${cp.minValue.toFixed(2)}` });
  if (cp.phoneOnly && phone && cp.phoneOnly !== String(phone).replace(/\D/g,'')) return NextResponse.json({ ok: false, error: 'Cupom restrito a outro cliente' });
  let discount = cp.kind === 'percent' ? (Number(subtotal) * cp.value) / 100 : cp.value;
  return NextResponse.json({ ok: true, kind: cp.kind, value: cp.value, discount });
}
