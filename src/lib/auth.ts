import * as jose from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-trocar');

export type Session = { id: string; name: string; email: string; role: string };

export async function signSession(s: Session) {
  return await new jose.SignJWT(s as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(SECRET);
}

export async function getSession(): Promise<Session | null> {
  try {
    const token = cookies().get('session')?.value;
    if (!token) return null;
    const { payload } = await jose.jwtVerify(token, SECRET);
    return payload as unknown as Session;
  } catch { return null; }
}

export const ROLE_PERMS: Record<string, string[]> = {
  admin: ['*'],
  gerente: ['dashboard','pedidos','pdv','mesas','caixa','cardapio','clientes','entregas','relatorios','promocoes','cupons','avaliacoes','estoque','cozinha','config'],
  caixa: ['dashboard','pedidos','pdv','mesas','caixa','clientes'],
  cozinha: ['cozinha','pedidos'],
  entregador: ['entregas'],
};

export function can(role: string, area: string) {
  const p = ROLE_PERMS[role] || [];
  return p.includes('*') || p.includes(area);
}
