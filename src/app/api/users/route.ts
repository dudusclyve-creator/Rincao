import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
export async function GET() { return NextResponse.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } })); }
export async function POST(req: Request) {
  const b = await req.json();
  if (b.id) return NextResponse.json(await prisma.user.update({ where: { id: b.id }, data: { name: b.name, role: b.role, active: b.active, permissions: b.permissions ? JSON.stringify(b.permissions) : undefined } }));
  return NextResponse.json(await prisma.user.create({ data: { name: b.name, email: b.email, passwordHash: await bcrypt.hash(b.password || '123456', 10), role: b.role || 'caixa' } }));
}
