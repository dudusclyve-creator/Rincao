import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
import { signSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
  const token = await signSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  const res = NextResponse.json({ ok: true, name: user.name, role: user.role });
  res.cookies.set('session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 12 });
  return res;
}
