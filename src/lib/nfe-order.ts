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
  // contador por ambiente: producao comeca em 1 (homologacao nao vale na producao)
  const key = 'nfeCounter' + (process.env.NFE_AMBIENTE === '1' ? 'Prod' : '');
  const s = await prisma.setting.findUnique({ where: { key } });
  const last = s ? (JSON.parse(s.value).last || 0) : 0;
  return last + 1;
}

async function saveNumero(numero: number) {
  try {
    const key = 'nfeCounter' + (process.env.NFE_AMBIENTE === '1' ? 'Prod' : '');
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify({ last: numero }) },
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
  let numero = await nextNumero();
  let r: any;
  // 539 = numero ja usado (sistema antigo do CNPJ): pula para o proximo livre e tenta de novo
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      r = await emitir(order, fiscal, numero);
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Falha ao enviar para a SEFAZ', http: 502 };
    }
    if (r.ok) break;
    const erro = String(r.erro || '');
    const m = erro.match(/chNFe:(\d{44})/);
    const usado = m ? parseInt(m[1].slice(25, 34), 10) : 0;
    if (!/^\s*539\b/.test(erro) || usado < numero) break;
    numero = usado + 1;
    await saveNumero(usado); // persiste o avanco: se cair o timeout, o proximo clique continua daqui
    r.erro = `${erro} — número ${usado} já usado pelo sistema antigo; seguindo para o próximo`;
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
  let erroFinal = /^\s*539\b/.test(String(r.erro || ''))
    ? `${r.erro} — clique em Emitir novamente para tentar o próximo número`
    : r.erro;
  if (/^\s*464\b/.test(String(r.erro || ''))) {
    erroFinal = `${r.erro} — token CSC de produção inválido: confira NFE_CSC_ID e NFE_CSC_TOKEN_PROD na Vercel (produção tem token próprio, diferente do de homologação)`;
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { nfeStatus: 'error', nfeError: (erroFinal || 'Erro desconhecido').slice(0, 500), nfeKey: r.chave || null },
  });
  if (r.xml) {
    try { writeFileSync('last_rejected.xml', r.xml); } catch {}
  }
  return { ok: false, error: r.erro || 'A SEFAZ rejeitou a nota', http: 502 };
}
