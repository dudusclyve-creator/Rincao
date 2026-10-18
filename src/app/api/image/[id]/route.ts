import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Serve as fotos gravadas no banco (enviadas pelo painel em /api/upload).
// A resposta fica marcada como imutável para o navegador/CDN guardar em cache.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const img = await prisma.image.findUnique({ where: { id: params.id } });
    if (!img || !img.bytes) {
      return new NextResponse('Imagem não encontrada', { status: 404 });
    }
    const dados = new Uint8Array(img.bytes as unknown as ArrayBuffer);
    return new NextResponse(dados, {
      status: 200,
      headers: {
        'Content-Type': img.mime || 'image/jpeg',
        'Content-Length': String(dados.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    console.error('[IMAGE] falha ao servir:', e);
    return new NextResponse('Erro ao carregar a imagem', { status: 500 });
  }
}
