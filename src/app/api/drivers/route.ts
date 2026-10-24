import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

// Quem e cadastrado na EQUIPE (/admin/usuarios) com o papel "entregador" tambem
// precisa aparecer no despacho do pedido. Antes a equipe e a lista de entregadores
// eram separadas e o motoboy novo nao aparecia na hora de despachar.
async function syncTeamDrivers() {
  try {
    const equipe = await prisma.user.findMany({ where: { role: 'entregador', active: true }, select: { name: true } });
    if (!equipe.length) return;
    const existentes = await prisma.driver.findMany({ select: { id: true, name: true } });
    const porNome = new Map(existentes.map((d) => [d.name.trim().toLowerCase(), d.id]));
    for (const u of equipe) {
      const nome = String(u.name || '').trim();
      if (!nome) continue;
      if (porNome.has(nome.toLowerCase())) continue;
      const criado = await prisma.driver.create({ data: { name: nome, phone: '' } });
      porNome.set(nome.toLowerCase(), criado.id);
    }
  } catch {}
}

export async function GET() {
  await syncTeamDrivers();
  const drivers = await prisma.driver.findMany({ orderBy: { name: 'asc' } });
  // Remove duplicates by name
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const d of drivers) {
    const key = d.name.trim().toLowerCase();
    if (seen.has(key)) {
      duplicates.push(d.id);
    } else {
      seen.set(key, d.id);
    }
  }
  if (duplicates.length > 0) {
    await prisma.driver.deleteMany({ where: { id: { in: duplicates } } });
    return NextResponse.json(await prisma.driver.findMany({ orderBy: { name: 'asc' } }));
  }
  return NextResponse.json(drivers);
}

export async function POST(req: Request) {
  const b = await req.json();
  if (b.id && b.status) {
    return NextResponse.json(await prisma.driver.update({ where: { id: b.id }, data: { status: b.status } }));
  }
  if (b.id && b.name) {
    const antes = await prisma.driver.findUnique({ where: { id: b.id }, select: { name: true } }).catch(() => null);
    const driver = await prisma.driver.update({ where: { id: b.id }, data: { name: b.name, phone: b.phone || '' } });
    // mesmo entregador na equipe: acompanha o novo nome (senao a lista recriaria o antigo)
    if (antes?.name && antes.name.trim().toLowerCase() !== String(b.name).trim().toLowerCase()) {
      try {
        await prisma.user.updateMany({
          where: { role: 'entregador', name: { equals: antes.name.trim(), mode: 'insensitive' } },
          data: { name: String(b.name).trim() },
        });
      } catch {}
    }
    return NextResponse.json(driver);
  }
  // Check for duplicate name (sem diferenciar maiusculas/espacos)
  const nome = String(b.name || '').trim();
  if (!nome) return NextResponse.json({ error: 'Informe o nome do entregador' }, { status: 400 });
  const existing = await prisma.driver.findFirst({ where: { name: { equals: nome, mode: 'insensitive' } } });
  if (existing) {
    return NextResponse.json(existing);
  }
  return NextResponse.json(await prisma.driver.create({ data: { name: nome, phone: b.phone || '' } }));
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const driver = await prisma.driver.findUnique({ where: { id } }).catch(() => null);
  await prisma.driver.delete({ where: { id } });
  // se esse entregador tambem esta na equipe (papel entregador), desativa o
  // acesso: senao ele voltaria a ser criado no proximo carregamento da lista
  if (driver?.name) {
    try {
      await prisma.user.updateMany({
        where: { role: 'entregador', active: true, name: { equals: driver.name.trim(), mode: 'insensitive' } },
        data: { active: false },
      });
    } catch {}
  }
  return NextResponse.json({ ok: true });
}
