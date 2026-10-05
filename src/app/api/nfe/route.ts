import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

const BASE = process.env.NOTAAS_URL || 'https://platform.notaas.com.br/api/v1';

async function notaas(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NOTAAS_API_KEY || '', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  return { ok: r.ok, status: r.status, data };
}

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

async function getFiscal() {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'fiscal' } });
    return s ? JSON.parse(s.value) : {};
  } catch { return {}; }
}

function buildPayload(order: any, fiscal: any) {
  const ncm = fiscal.ncmPadrao || '21069090';
  const cfop = fiscal.cfopPadrao || '5102';
  const items: any[] = order.items.map((it: any, i: number) => {
    const addons = JSON.parse(it.addonsJson || '[]');
    const addonUnit = addons.reduce((s: number, a: any) => s + (a.price || 0) * (a.qty || 1), 0);
    const gross = money(it.qty * ((it.unitPrice || 0) + addonUnit));
    const descricao = [it.name, ...addons.map((a: any) => a.name)].join(' + ').slice(0, 100);
    return {
      codigo: `P${i + 1}`, descricao, ncm, cfop,
      quantidade: it.qty, valorUnitario: money(gross / (it.qty || 1)),
      valorTotal: gross, unidade: 'UN',
    };
  });
  if ((order.deliveryFee || 0) > 0) {
    items.push({
      codigo: 'TAXA', descricao: 'Taxa de entrega', ncm, cfop,
      quantidade: 1, valorUnitario: money(order.deliveryFee), valorTotal: money(order.deliveryFee), unidade: 'UN',
    });
  }
  if (items.length === 0) throw new Error('Pedido sem itens');

  // garante soma dos itens = total + desconto (vNF = soma - desconto)
  const wantGross = money((order.total || 0) + (order.discount || 0));
  const sum = money(items.reduce((s, i) => s + i.valorTotal, 0));
  const diff = money(wantGross - sum);
  if (diff !== 0 && items[0].valorTotal + diff > 0) {
    items[0].valorTotal = money(items[0].valorTotal + diff);
    items[0].valorUnitario = money(items[0].valorTotal / items[0].quantidade);
  }
  // distribui o desconto nos itens
  let rest = money(order.discount || 0);
  for (const it of items) {
    if (rest <= 0) break;
    const d = Math.min(rest, it.valorTotal);
    it.desconto = money(d);
    rest = money(rest - d);
  }

  const payMap: Record<string, string> = { dinheiro: '01', pix: '17', debito: '04', credito: '03', cartao: '03' };
  const pagamentos: any[] = [];
  if ((order.payment || '').includes(',')) {
    order.payment.split(',').forEach((p: string) => {
      const [m, v] = p.split(':');
      const amount = money(Number(v) || 0);
      if (amount > 0) {
        pagamentos.push({ tipoPagamento: payMap[m] || '99', valor: amount, ...(payMap[m] ? {} : { descricaoPagamento: m }) });
      }
    });
  } else {
    const m = order.payment;
    let amount = money(order.total);
    if (m === 'dinheiro' && order.changeFor && order.changeFor > 0) amount = money(order.changeFor);
    pagamentos.push({ tipoPagamento: payMap[m] || '99', valor: amount, ...(payMap[m] ? {} : { descricaoPagamento: m }) });
  }
  if (pagamentos.length === 0) pagamentos.push({ tipoPagamento: '99', valor: money(order.total), descricaoPagamento: 'NAO INFORMADO' });
  const ps = money(pagamentos.reduce((s, p) => s + p.valor, 0));
  const target = money(order.total);
  if (ps !== target) pagamentos[pagamentos.length - 1].valor = Math.max(0, money(pagamentos[pagamentos.length - 1].valor + (target - ps)));

  const isRealDelivery = order.type === 'entrega'
    && !(order.addressText || '').toUpperCase().includes('RETIRADA')
    && !(order.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL');

  return {
    modelo: 65,
    naturezaOperacao: fiscal.naturezaOperacao || 'VENDA DE MERCADORIA',
    items,
    pagamentos,
    presencaComprador: isRealDelivery ? 4 : 1,
    consumidorFinal: 1,
    infcpl: `Pedido #${order.number} - Rincao Lanches`,
  };
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const { action, orderId } = b;
    if (!orderId) return NextResponse.json({ error: 'Pedido não informado' }, { status: 400 });
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    if (!process.env.NOTAAS_API_KEY) return NextResponse.json({ error: 'NOTAAS_API_KEY não configurada — crie a conta na Notaas e adicione a chave no .env' }, { status: 500 });

    if (action === 'emit') {
      if (order.nfeStatus && order.nfeStatus !== 'error') {
        return NextResponse.json({ error: 'Este pedido já tem nota fiscal' }, { status: 409 });
      }
      if ((order.type === 'entrega' || (order.addressText || '').toLowerCase().includes('rivera')) && /rivera/i.test(order.addressText || '')) {
        return NextResponse.json({ error: 'Entrega em Rivera (exterior) — a NFC-e não aceita destino fora do Brasil. Emita a NF-e manualmente pelo contador.' }, { status: 400 });
      }
      let payload: any;
      try { payload = buildPayload(order, await getFiscal()); } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Falha ao montar a nota' }, { status: 400 });
      }
      const r = await notaas('/nfe/emitir', { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok || !r.data?.invoiceId) {
        return NextResponse.json({ error: r.data || `Notaas retornou ${r.status}` }, { status: 502 });
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { nfeInvoiceId: r.data.invoiceId, nfeStatus: r.data.status || 'queued', nfeError: null, nfeNumber: null, nfeKey: null },
      });
      return NextResponse.json({ invoiceId: r.data.invoiceId, status: r.data.status || 'queued' });
    }

    if (action === 'status') {
      if (!order.nfeInvoiceId) return NextResponse.json({ error: 'Nota não enviada' }, { status: 400 });
      const r = await notaas(`/nfe/invoices/${order.nfeInvoiceId}/status`);
      if (!r.ok) return NextResponse.json({ error: r.data || `Notaas retornou ${r.status}` }, { status: 502 });
      const d = r.data || {};
      const data: any = { nfeStatus: d.status || order.nfeStatus };
      if (d.numero ?? d.nNf) data.nfeNumber = d.numero ?? d.nNf;
      if (d.chaveAcesso) data.nfeKey = d.chaveAcesso;
      if (d.pdfUrl) data.nfePdfUrl = d.pdfUrl;
      if (d.xmlUrl) data.nfeXmlUrl = d.xmlUrl;
      if (d.qrCode) data.nfeQrCode = d.qrCode;
      if (d.status === 'issued') {
        data.nfeError = null;
        if (d.dataRecebimento || d.dhRecbto) data.nfeIssuedAt = new Date(d.dataRecebimento || d.dhRecbto);
      }
      if (d.status === 'error') {
        data.nfeError = [d.codigoStatus ?? d.cStat, d.motivo ?? d.xMotivo, d.errorMessage].filter(Boolean).join(' — ');
      }
      if (d.status === 'cancelled') {
        if (d.cancelledAt) data.nfeCancelledAt = new Date(d.cancelledAt);
        if (d.cancelMotivo) data.nfeError = d.cancelMotivo;
      }
      await prisma.order.update({ where: { id: order.id }, data });
      return NextResponse.json({ ...d, savedStatus: data.nfeStatus });
    }

    if (action === 'cancel') {
      if (!order.nfeInvoiceId) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 400 });
      const motivo = String(b.motivo || '').trim();
      if (motivo.length < 15) return NextResponse.json({ error: 'Motivo precisa de ao menos 15 caracteres (exigência da SEFAZ)' }, { status: 400 });
      const r = await notaas('/nfe/cancelar', { method: 'POST', body: JSON.stringify({ invoiceId: order.nfeInvoiceId, motivo }) });
      if (!r.ok) return NextResponse.json({ error: r.data || `Notaas retornou ${r.status}` }, { status: 502 });
      await prisma.order.update({ where: { id: order.id }, data: { nfeStatus: 'processing' } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

// proxy do DANFE/XML (as URLs da Notaas exigem a API key, então servimos por aqui)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const doc = searchParams.get('doc') === 'xml' ? 'xml' : 'danfe';
    if (!orderId) return NextResponse.json({ error: 'Pedido não informado' }, { status: 400 });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order?.nfeInvoiceId) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 });
    if (!process.env.NOTAAS_API_KEY) return NextResponse.json({ error: 'NOTAAS_API_KEY não configurada' }, { status: 500 });
    const r = await fetch(`${BASE}/nfe/invoices/${order.nfeInvoiceId}/${doc}`, {
      headers: { 'x-api-key': process.env.NOTAAS_API_KEY },
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ error: `Falha ao baixar ${doc} (${r.status})` }, { status: 502 });
    const buf = Buffer.from(await r.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        'Content-Type': r.headers.get('content-type') || (doc === 'xml' ? 'application/xml' : 'application/pdf'),
        'Content-Disposition': `inline; filename="nota-${order.number}.${doc === 'xml' ? 'xml' : 'pdf'}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
