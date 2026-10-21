import crypto from 'crypto';

// Assinatura servidor->servidor do pedido de emissao de nota (app -> site).
// Usa NFE_PROXY_SECRET (mesma chave no .env do app e na Vercel).
function chave(): Buffer {
  return crypto.createHash('sha256').update(String(process.env.NFE_PROXY_SECRET || '')).digest();
}

export function nfeProxySign(payload: string): string {
  return crypto.createHmac('sha256', chave()).update(payload).digest('hex');
}

export function nfeProxySignOk(payload: string, sig: string): boolean {
  const segredo = String(process.env.NFE_PROXY_SECRET || '');
  if (!segredo || !sig) return false;
  const esperado = nfeProxySign(payload);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
  } catch {
    return false;
  }
}
