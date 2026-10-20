import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const CAMPOS = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;

export async function GET() { return NextResponse.json(await prisma.user.findMany({ select: CAMPOS })); }

export async function POST(req: Request) {
  const b = await req.json();

  // atualizar membro existente
  if (b.id) {
    const data: any = {};
    if (b.name !== undefined) {
      const nome = String(b.name).trim();
      if (!nome) return NextResponse.json({ error: 'Informe o nome' }, { status: 400 });
      data.name = nome;
    }
    if (b.email !== undefined) {
      const email = String(b.email).trim().toLowerCase();
      if (!email) return NextResponse.json({ error: 'Informe o e-mail' }, { status: 400 });
      data.email = email;
    }
    if (b.role !== undefined) data.role = String(b.role);
    if (b.active !== undefined) data.active = !!b.active;
    if (b.permissions !== undefined) data.permissions = JSON.stringify(b.permissions);
    // senha: sempre salvamos o hash (bcrypt). Em branco = mantem a atual.
    if (b.password) {
      const senha = String(b.password);
      if (senha.length < 4) return NextResponse.json({ error: 'A senha precisa ter pelo menos 4 caracteres' }, { status: 400 });
      data.passwordHash = await bcrypt.hash(senha, 10);
    }
    try {
      const user = await prisma.user.update({ where: { id: b.id }, data, select: CAMPOS });
      return NextResponse.json(user);
    } catch (e: any) {
      if (e?.code === 'P2002') return NextResponse.json({ error: 'Ja existe outro membro com esse e-mail' }, { status: 400 });
      return NextResponse.json({ error: 'Nao foi possivel salvar o membro' }, { status: 400 });
    }
  }

  // criar novo membro
  const nome = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const senha = String(b.password || '');
  if (!nome || !email || !senha) return NextResponse.json({ error: 'Preencha nome, e-mail e senha' }, { status: 400 });
  if (senha.length < 4) return NextResponse.json({ error: 'A senha precisa ter pelo menos 4 caracteres' }, { status: 400 });
  try {
    const user = await prisma.user.create({
      data: { name: nome, email, passwordHash: await bcrypt.hash(senha, 10), role: b.role || 'caixa' },
      select: CAMPOS,
    });
    return NextResponse.json(user);
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'Ja existe um membro com esse e-mail' }, { status: 400 });
    return NextResponse.json({ error: 'Nao foi possivel criar o membro' }, { status: 400 });
  }
}
