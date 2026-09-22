import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

export async function GET() {
  const r = await prisma.restaurant.findUnique({ where: { id: 'single' } });
  return NextResponse.json(r);
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
  }});
  return NextResponse.json(r);
}
