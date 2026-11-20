import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { getMpAccount, resetPixCache } from '@/lib/pix';

// Le o estado do Mercado Pago sem nunca devolver o token para o navegador.
async function mpState() {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'mercadoPago' } });
    const j = s ? JSON.parse(s.value) : null;
    const token = String(j?.accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
    return {
      configured: !!token,
      enabled: !!token && j?.enabled !== false,
      account: String(j?.accountName || ''),
      token,
      raw: (j || {}) as any,
    };
  } catch {
    return { configured: false, enabled: false, account: '', token: '', raw: {} as any };
  }
}

export async function GET() {
  const r = await prisma.restaurant.findUnique({ where: { id: 'single' } });
  const mp = await mpState();
  // nunca devolve o token: so se esta configurado/ligado e o nome da conta
  return NextResponse.json({ ...r, pixConfigured: mp.configured, pixEnabled: mp.enabled, mpAccount: mp.account });
}

export async function PATCH(req: Request) {
  const b = await req.json();
  const mp = await mpState();
  let mpAccount: { id: string; nickname: string; email: string } | null = null;

  // 1) token novo: valida no Mercado Pago ANTES de salvar
  if (typeof b.mpAccessToken === 'string' && b.mpAccessToken.trim()) {
    const token = b.mpAccessToken.trim();
    try {
      mpAccount = await getMpAccount(token);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Token do Mercado Pago inválido' }, { status: 400 });
    }
    const enabled = b.mpEnabled !== undefined ? !!b.mpEnabled : true;
    const accountName = mpAccount.nickname || mpAccount.email || mpAccount.id;
    await prisma.setting.upsert({
      where: { key: 'mercadoPago' },
      create: { key: 'mercadoPago', value: JSON.stringify({ accessToken: token, enabled, accountName }) },
      update: { value: JSON.stringify({ accessToken: token, enabled, accountName }) },
    });
    resetPixCache();
  // 2) "testar conexao" com o token que ja esta salvo
  } else if (b.mpAction === 'test') {
    if (!mp.token) return NextResponse.json({ error: 'Nenhum token do Mercado Pago salvo ainda' }, { status: 400 });
    try {
      mpAccount = await getMpAccount(mp.token);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Token do Mercado Pago inválido' }, { status: 400 });
    }
    const accountName = mpAccount.nickname || mpAccount.email || mpAccount.id;
    await prisma.setting.upsert({
      where: { key: 'mercadoPago' },
      create: { key: 'mercadoPago', value: JSON.stringify({ accessToken: mp.token, enabled: true, accountName }) },
      update: { value: JSON.stringify({ accessToken: mp.token, enabled: mp.raw?.enabled !== false, accountName }) },
    });
  // 3) liga/desliga sem apagar o token
  } else if (b.mpEnabled !== undefined) {
    if (!mp.token && b.mpEnabled) {
      return NextResponse.json({ error: 'Salve o Access Token do Mercado Pago antes de ligar' }, { status: 400 });
    }
    if (mp.token) {
      await prisma.setting.upsert({
        where: { key: 'mercadoPago' },
        create: { key: 'mercadoPago', value: JSON.stringify({ accessToken: mp.token, enabled: !!b.mpEnabled, accountName: mp.account }) },
        update: { value: JSON.stringify({ accessToken: mp.token, enabled: !!b.mpEnabled, accountName: mp.account }) },
      });
      resetPixCache();
    }
  }

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

  const after = await mpState();
  return NextResponse.json({
    ...r,
    pixConfigured: after.configured,
    pixEnabled: after.enabled,
    mpAccount: mpAccount ? (mpAccount.nickname || mpAccount.email || mpAccount.id) : after.account,
  });
}
