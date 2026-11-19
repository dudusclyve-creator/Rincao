import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { resetPixCache } from '@/lib/pix';

export async function GET() {
  const r = await prisma.restaurant.findUnique({ where: { id: 'single' } });
  let pixConfigured = false;
  let pixEnabled = false;
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'mercadoPago' } });
    const j = s ? JSON.parse(s.value) : null;
    const token = String(j?.accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
    pixConfigured = !!token;
    pixEnabled = pixConfigured && j?.enabled !== false;
  } catch {}
  // nunca devolve o token: so se esta configurado/ligado
  return NextResponse.json({ ...r, pixConfigured, pixEnabled });
}
export async function PATCH(req: Request) {
  const b = await req.json();
  const r = await prisma.restaurant.update({ where: { id: 'single' }, data: {
    name: b.name, logoUrl: b.logoUrl, bannerUrl: b.bannerUrl, phone: b.phone, whatsapp: b.whatsapp,
    address: b.address, pixKey: b.pixKey, deliveryFee: b.deliveryFee !== undefined ? Number(b.deliveryFee) : undefined,
    minOrder: b.minOrder !== undefined ? Number(b.minOrder) : undefined,
    prepTimeMin: b.prepTimeMin !== undefined ? Number(b.prepTimeMin) : undefined,
    isOpenManual: b.isOpenManual, payments: b.payments ? JSON.stringify(b.payments) : undefined,
    hoursJson: b.hoursJson ? JSON.stringify(b.hoursJson) : undefined,
    printerWidth: b.printerWidth, printerAuto: b.printerAuto, printerName: b.printerName,
    autoAccept: b.autoAccept,
    cardFeeCredit: b.cardFeeCredit !== undefined ? Math.min(100, Math.max(0, Number(b.cardFeeCredit) || 0)) : undefined,
    cardFeeDebit: b.cardFeeDebit !== undefined ? Math.min(100, Math.max(0, Number(b.cardFeeDebit) || 0)) : undefined,
  }});
  // Mercado Pago: token fica em Setting (nunca na Restaurant, que e publica).
  // Campo vazio mantem o token atual; "mpEnabled" liga/desliga sem apagar.
  if (b.mpEnabled !== undefined || (typeof b.mpAccessToken === 'string' && b.mpAccessToken.trim())) {
    const cur = await prisma.setting.findUnique({ where: { key: 'mercadoPago' } }).catch(() => null);
    let prev: any = {};
    try { prev = cur ? JSON.parse(cur.value) : {}; } catch {}
    const token = typeof b.mpAccessToken === 'string' && b.mpAccessToken.trim() ? b.mpAccessToken.trim() : String(prev?.accessToken || '');
    const enabled = b.mpEnabled !== undefined ? !!b.mpEnabled : prev?.enabled !== false;
    await prisma.setting.upsert({
      where: { key: 'mercadoPago' },
      create: { key: 'mercadoPago', value: JSON.stringify({ accessToken: token, enabled }) },
      update: { value: JSON.stringify({ accessToken: token, enabled }) },
    });
    resetPixCache();
  }
  return NextResponse.json(r);
}
