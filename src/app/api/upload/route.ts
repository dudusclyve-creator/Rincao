import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const BUCKET = 'product-images';

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
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'true',
          },
          body: bytes,
        });
        if (r.ok) {
          return NextResponse.json({ url: `${base}/storage/v1/object/public/${BUCKET}/${filename}` });
        }
        const errText = await r.text();
        console.error('[UPLOAD] storage recusou:', r.status, errText.slice(0, 300));
      } catch (e) {
        console.error('[UPLOAD] erro no storage:', e);
      }
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), Buffer.from(bytes));
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (e) {
    console.error('[UPLOAD] falha geral:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
