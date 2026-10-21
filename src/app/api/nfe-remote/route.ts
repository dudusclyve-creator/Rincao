import { NextResponse } from 'next/server';
import { handleNfe } from '@/lib/nfe-api';
import { nfeProxySignOk } from '@/lib/nfe-proxy';

export const dynamic = 'force-dynamic';

// Recebe a emissao/cancelamento repassada pelo app portatil (que nao tem o
// certificado A1 no .env) e executa aqui, onde o certificado esta configurado.
// Protegido por HMAC (NFE_PROXY_SECRET) — nao aceita chamada sem assinatura.
export async function POST(req: Request) {
  const raw = await req.text();
  const assinatura = req.headers.get('x-rincao-sign') || '';
  if (!nfeProxySignOk(raw, assinatura)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let b: any = {};
  try {
    b = JSON.parse(raw || '{}');
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const r = await handleNfe(b);
  return NextResponse.json(r.body, { status: r.status });
}
