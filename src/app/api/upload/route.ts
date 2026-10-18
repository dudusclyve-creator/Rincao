import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BUCKET = 'product-images';

// A Vercel limita o corpo da requisicao a ~4,5 MB. O painel tambem reduz a foto
// antes de enviar, entao na pratica as imagens ficam bem menores que isso.
const MAX_BYTES = 4 * 1024 * 1024;

const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];

async function ensureBucket(base: string, key: string) {
  try {
    await fetch(`${base}/storage/v1/bucket`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Imagem muito grande (máximo 4 MB)' }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const bruta = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const ext = EXTS.includes(bruta) ? bruta : 'jpg';
    const mime = String(file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // 1) Supabase Storage — usado quando as chaves estão configuradas (nuvem, CDN)
    const base = process.env.SUPABASE_STORAGE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (base && serviceKey) {
      try {
        await ensureBucket(base, serviceKey);
        const r = await fetch(`${base}/storage/v1/object/${BUCKET}/${filename}`, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': mime,
            'x-upsert': 'true',
          },
          body: buffer,
        });
        if (r.ok) {
          return NextResponse.json({ url: `${base}/storage/v1/object/public/${BUCKET}/${filename}`, onde: 'storage' });
        }
        console.error('[UPLOAD] storage recusou:', r.status, (await r.text()).slice(0, 300));
      } catch (e) {
        console.error('[UPLOAD] erro no storage:', e);
      }
    }

    // 2) Banco de dados — funciona em qualquer lugar (o site roda na Vercel, que
    // não deixa gravar arquivo em disco). A imagem é servida em /api/image/<id>.
    const img = await prisma.image.create({
      data: { mime, name: file.name.slice(0, 120), bytes: buffer },
    });
    return NextResponse.json({ url: `/api/image/${img.id}`, onde: 'banco' });
  } catch (e) {
    console.error('[UPLOAD] falha geral:', e);
    return NextResponse.json({ error: 'Falha no upload' }, { status: 500 });
  }
}
