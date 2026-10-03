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

export { ROLE_PERMS, can } from '@/lib/roles';
