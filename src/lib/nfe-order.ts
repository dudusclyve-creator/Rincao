import { prisma } from './db';
import { emitir } from './nfe';
import { writeFileSync } from 'fs';

async function getFiscal(): Promise<any> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'fiscal' } });
    return s ? JSON.parse(s.value) : {};
  } catch { return {}; }
}

async function nextNumero(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'nfeCounter' } });
  const last = s ? (JSON.parse(s.value).last || 0) : 0;
  return last + 1;
}

async function saveNumero(numero: number) {
  try {
    await prisma.setting.upsert({
      where: { key: 'nfeCounter' },
      create: { key: 'nfeCounter', value: JSON.stringify({ last: numero }) },
      update: { value: JSON.stringify({ last: numero }) },
    });
  } catch {}
}

export interface EmitResult {
  ok: boolean;
  error?: string;
  http?: number;
  numero?: number;
  chave?: string;
  nProt?: string;
}

export async function emitirPedido(orderId: string): Promise<EmitResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, customer: true } });
  if (!order) return { ok: false, error: 'Pedido não encontrado', http: 404 };
  if (order.nfeStatus && order.nfeStatus !== 'error') return { ok: false, error: 'Este pedido já tem nota fiscal', http: 409 };
  if (/rivera/i.test(order.addressText || '')) {
    return { ok: false, error: 'Entrega em Rivera (exterior) — a NFC-e não aceita destino fora do Brasil. Emita a NF-e manualmente pelo contador.', http: 400 };
  }
  const entregaSemCpf =
    (order.type || '') === 'entrega' &&
    !String(order.addressText || '').toUpperCase().includes('RETIRADA') &&
    !String(order.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL') &&
    String(order.customer?.cpf || '').replace(/\D/g, '').length !== 11;
  if (entregaSemCpf) {
    return { ok: false, error: 'Pedido de entrega sem CPF do cliente. A NFC-e de entrega exige o CPF do destinatário — cadastre o CPF no menu Clientes e tente novamente.', http: 400 };
  }
  if (!order.items.length) return { ok: false, error: 'Pedido sem itens', http: 400 };
  if (!process.env.NFE_CERT_PFX_B64) return { ok: false, error: 'NFE_CERT_PFX_B64 não configurada no .env da Vercel', http: 500 };

  const fiscal = await getFiscal();
  const numero = await nextNumero();
  let r: any;
  try {
    r = await emitir(order, fiscal, numero);
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao enviar para a SEFAZ', http: 502 };
  }
  if (r.ok) {
    await saveNumero(numero);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        nfeStatus: 'issued',
        nfeNumber: numero,
        nfeKey: r.chave || null,
        nfeProtocol: r.nProt || null,
        nfeXml: r.xml || null,
        nfeQrCode: r.qrUrl || null,
        nfeError: null,
        nfeIssuedAt: new Date(),
        nfeCancelledAt: null,
      },
    });
    return { ok: true, numero, chave: r.chave, nProt: r.nProt };
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { nfeStatus: 'error', nfeError: (r.erro || 'Erro desconhecido').slice(0, 500), nfeKey: r.chave || null },
  });
  if (r.xml) {
    try { writeFileSync('last_rejected.xml', r.xml); } catch {}
  }
  return { ok: false, error: r.erro || 'A SEFAZ rejeitou a nota', http: 502 };
}
