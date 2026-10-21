import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';
import { can, areaForPath, ROLE_HOME } from '@/lib/roles';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-trocar');

async function verifyToken(token: string): Promise<{ ok: boolean; role?: string }> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return { ok: true, role: (payload.role as string) || '' };
  } catch { return { ok: false }; }
}

// Leitura publica: o cardapio precisa desses dados sem login.
// ATENCAO: aqui so entram GET/HEAD/OPTIONS. Escrita fica sempre autenticada.
const PUBLIC_GET = [
  '/api/auth',
  '/api/menu',
  '/api/settings',
  '/api/delivery-areas',
  '/api/image',
];

// Escrita publica: login e criacao de pedido pelo cardapio.
const PUBLIC_POST = [
  '/api/auth',
  '/api/orders',
];

function matchesAny(pathname: string, list: string[]) {
  return list.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin pages — require valid JWT + role permission
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const session = req.cookies.get('session')?.value;
    if (!session) return NextResponse.redirect(new URL('/admin/login', req.url));
    const { ok, role } = await verifyToken(session);
    if (!ok) {
      const res = NextResponse.redirect(new URL('/admin/login', req.url));
      res.cookies.delete('session');
      return res;
    }
    if (role && !can(role, areaForPath(pathname))) {
      const home = ROLE_HOME[role] || '/admin/login';
      if (pathname !== home) return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  }

  // Admin login — allow if no valid session, redirect to admin if valid
  if (pathname === '/admin/login') {
    const session = req.cookies.get('session')?.value;
    if (session && (await verifyToken(session)).ok) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return NextResponse.next();
  }

  // API routes — por metodo: leitura publica, escrita autenticada
  if (pathname.startsWith('/api')) {
    const isRead = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';

    if (isRead && matchesAny(pathname, PUBLIC_GET)) return NextResponse.next();
    if (req.method === 'POST' && matchesAny(pathname, PUBLIC_POST)) return NextResponse.next();

    // Todo o resto exige sessao valida (ex.: PATCH /api/settings, POST /api/upload)
    const session = req.cookies.get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const valid = await verifyToken(session);
    if (!valid.ok) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
