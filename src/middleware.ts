import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-trocar');

async function verifyToken(token: string): Promise<boolean> {
  try {
    await jose.jwtVerify(token, JWT_SECRET);
    return true;
  } catch { return false; }
}

const PUBLIC_API = [
  '/api/auth',
  '/api/menu',
  '/api/settings',
  '/api/upload',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin pages — require valid JWT
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const session = req.cookies.get('session')?.value;
    if (!session) return NextResponse.redirect(new URL('/admin/login', req.url));
    const valid = await verifyToken(session);
    if (!valid) {
      const res = NextResponse.redirect(new URL('/admin/login', req.url));
      res.cookies.delete('session');
      return res;
    }
    return NextResponse.next();
  }

  // Admin login — allow if no valid session, redirect to admin if valid
  if (pathname === '/admin/login') {
    const session = req.cookies.get('session')?.value;
    if (session && await verifyToken(session)) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return NextResponse.next();
  }

  // API routes — require JWT for non-public endpoints
  if (pathname.startsWith('/api')) {
    // Public API endpoints
    if (PUBLIC_API.some(p => pathname.startsWith(p))) return NextResponse.next();

    // POST /api/orders is public (cardápio checkout) — but only POST, not PATCH/DELETE
    if (pathname === '/api/orders' && req.method === 'POST') return NextResponse.next();

    // Everything else requires auth
    const session = req.cookies.get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const valid = await verifyToken(session);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
