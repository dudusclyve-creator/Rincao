import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

// canvas virtual do salao: as posicoes sao salvas nessa escala e o front
// converte para % (assim a vista aerea funciona em qualquer tela)
const CANVAS_W = 1200;
const CANVAS_H = 760;

const clampInt = (v: any, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const layoutData = (t: any) => ({
  posX: clampInt(t.posX, 0, CANVAS_W, 0),
  posY: clampInt(t.posY, 0, CANVAS_H, 0),
  width: clampInt(t.width, 56, CANVAS_W, 120),
  height: clampInt(t.height, 56, CANVAS_H, 120),
  shape: ['square', 'round', 'rect'].includes(t.shape) ? t.shape : 'square',
  rotation: clampInt(t.rotation, 0, 359, 0),
  seats: clampInt(t.seats, 0, 20, 4),
});

export async function GET() { return NextResponse.json(await prisma.tableMap.findMany({ orderBy: { number: 'asc' } })); }
export async function POST(req: Request) {
  const b = await req.json();
  if (b.action === 'create') {
    return NextResponse.json(await prisma.tableMap.create({
      data: { number: String(b.number), ...layoutData(b) },
    }));
  }
  if (b.action === 'status') return NextResponse.json(await prisma.tableMap.update({ where: { id: b.id }, data: { status: b.status } }));

  // Salva o desenho inteiro do salao de uma vez (posicao, tamanho, forma,
  // rotacao, cadeiras e o numero da mesa).
  if (b.action === 'layout' && Array.isArray(b.tables)) {
    try {
      await prisma.$transaction(
        b.tables.map((t: any) => prisma.tableMap.update({
          where: { id: t.id },
          data: {
            ...layoutData(t),
            number: t.number !== undefined ? String(t.number).trim() : undefined,
          },
        })),
      );
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('Unique constraint')) {
        return NextResponse.json({ error: 'Ja existe uma mesa com esse numero' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Nao foi possivel salvar o layout' }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'x' }, { status: 400 });
}
