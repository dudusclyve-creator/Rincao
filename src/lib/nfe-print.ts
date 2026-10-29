import QRCode from 'qrcode';
import { BRL } from './utils';

const escapeHtml = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const escapeAttr = (s: any) => escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const PAY_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Cartão de débito',
  credito: 'Cartão de crédito', cartao: 'Cartão',
};

// largura do DANFE na fonte normal: 576 dots / 12 dots por caractere = 48 colunas
const DANFE_COLS = 48;

// Monta o DANFE em texto puro, do mesmo jeito que uma impressora fiscal imprime.
// A linha "[[QR]]" e trocada pelo QR Code na hora de enviar para a impressora.
export function danfeTexto(o: any): string {
  const W = DANFE_COLS;
  const L: string[] = [];
  const linha = (s = '') => L.push(String(s).slice(0, W));
  const central = (s: string) => {
    const t = String(s).slice(0, W);
    linha(' '.repeat(Math.max(0, Math.floor((W - t.length) / 2))) + t);
  };
  const par = (esq: string, dir: string) => {
    const e = String(esq);
    if (!dir) { linha(e); return; }
    if (e.length + dir.length + 1 > W) { linha(e); linha(' '.repeat(Math.max(0, W - dir.length)) + dir); return; }
    linha(e + ' '.repeat(Math.max(1, W - e.length - dir.length)) + dir);
  };
  const sep = (ch = '-') => linha(ch.repeat(W));
  const quebra = (s: string, indent = '') => {
    const largura = W - indent.length;
    const palavras = String(s).split(/\s+/).filter(Boolean);
    let atual = '';
    const out: string[] = [];
    for (const p of palavras) {
      if (!atual) atual = p;
      else if ((atual + ' ' + p).length <= largura) atual += ' ' + p;
      else { out.push(indent + atual); atual = p; }
    }
    out.push(indent + atual);
    return out;
  };

  const homolog = String(o.nfeQrCode || '').split('|')[2] === '2';

  sep('=');
  central('DANFE NFC-e');
  quebra('Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica').forEach((l) => central(l));
  sep('=');
  if (homolog) {
    sep('*');
    central('AMBIENTE DE HOMOLOGAÇÃO');
    central('SEM VALOR FISCAL');
    sep('*');
  }
  sep();
  central('43 - EMITENTE');
  linha('SANDRA REGINA DE MENEZES PIRES');
  linha('RINCAO LANCHES');
  linha('CNPJ: 42.462.389/0001-37');
  linha('IE: 1060172256');
  quebra('AVENIDA DOM PEDRO II, 1694 - UMBU').forEach(linha);
  quebra('SANTANA DO LIVRAMENTO/RS - CEP 97577-372').forEach(linha);
  linha('Fone: (55) 98437-5004');
  sep();

  central(`#${o.nfeNumber} - DESTINATÁRIO / CONSUMIDOR`);
  quebra(`CONSUMIDOR NÃO IDENTIFICADO${o.customerName ? ' - ' + o.customerName : ''}`).forEach(linha);
  sep();

  for (const it of o.items || []) {
    let addons: any[] = [];
    try { addons = JSON.parse(it.addonsJson || '[]'); } catch { addons = []; }
    const au = addons.reduce((s: number, a: any) => s + (a.price || 0) * (a.qty || 1), 0);
    const g = Math.round(it.qty * ((it.unitPrice || 0) + au) * 100) / 100;
    const nome = [it.name, ...addons.map((a: any) => a.name)].join(' + ');
    par(`${it.qty}x ${nome}`, BRL(g));
  }
  if ((o.deliveryFee || 0) > 0) par('1x Taxa de entrega', BRL(o.deliveryFee));
  sep();

  par('SUBTOTAL', BRL(o.subtotal));
  if ((o.discount || 0) > 0) par('DESCONTO', '-' + BRL(o.discount));
  par('VALOR TOTAL', BRL(o.total));
  sep();

  const payStr = String(o.payment || '');
  const payTexto = payStr.includes(',')
    ? payStr.split(',').map((p) => {
        const i = p.lastIndexOf(':');
        const m = i > 0 ? p.slice(0, i) : p;
        const v = i > 0 ? Number(p.slice(i + 1)) : 0;
        return `${PAY_LABEL[m] || m} ${BRL(v)}`;
      }).join(' + ')
    : `${PAY_LABEL[payStr] || payStr || '-'}`;
  quebra(`PAGAMENTO: ${payTexto}`).forEach(linha);
  if (payStr === 'dinheiro' && o.changeFor > 0) quebra(`Troco para ${BRL(o.changeFor)}`).forEach(linha);
  sep();

  central('CONSULTA DE AUTENTICIDADE');
  const chave = String(o.nfeKey || '').replace(/\D/g, '');
  const grupos = chave.match(/.{1,4}/g) || [];
  for (let i = 0; i < grupos.length; i += 8) linha('  ' + grupos.slice(i, i + 8).join(' '));
  quebra(`Protocolo de autorização: ${o.nfeProtocol || '-'}`).forEach(linha);
  quebra('Consulte pelo QR Code ou em www.sefaz.rs.gov.br/nfce/consulta').forEach(linha);
  linha('');
  linha('[[QR]]');
  linha('');
  sep();
  central('Rincao Lanches - Obrigado pela preferência!');
  return L.join('\n');
}

export async function printDanfe(o: any) {
  try {
    const qrTexto = String(o.nfeQrCode || '');
    const qr = qrTexto
      ? await QRCode.toDataURL(qrTexto, { width: 460, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      : '';
    const homolog = (qrTexto.split('|')[2] || '') === '2';
    const rows = (o.items || [])
      .map((it: any) => {
        const addons = JSON.parse(it.addonsJson || '[]');
        const au = addons.reduce((s: number, a: any) => s + (a.price || 0) * (a.qty || 1), 0);
        const g = Math.round((it.qty * ((it.unitPrice || 0) + au)) * 100) / 100;
        const nome = [it.name, ...addons.map((a: any) => a.name)].join(' + ');
        return `<tr><td>${it.qty}x ${escapeHtml(nome)}</td><td class="r">${BRL(g)}</td></tr>`;
      })
      .join('');
    const feeRow = (o.deliveryFee || 0) > 0 ? `<tr><td>1x Taxa de entrega</td><td class="r">${BRL(o.deliveryFee)}</td></tr>` : '';
    const payMap: any = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Cartão de débito', credito: 'Cartão de crédito', cartao: 'Cartão' };
    const chaveFmt = (o.nfeKey || '').replace(/(\d{4})(?=\d)/g, '$1 ');

    // versao em texto puro (fonte normal, 48 colunas). Fica escondida: no
    // aplicativo quem imprime e a impressora termica via ESC/POS, e o processo
    // principal le justamente este bloco. No site ela nao aparece na impressao.
    const textoCupom = danfeTexto(o);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>DANFE NFC-e #${o.nfeNumber}</title><style>
      @page { size: 80mm auto; margin: 3mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; font-size: 12.5px; font-weight: bold; width: 74mm; margin: 0 auto; color: #000; }
      h1 { font-size: 15px; text-align: center; margin: 4px 0 0; }
      .c { text-align: center; } .r { text-align: right; }
      hr { border: none; border-top: 1.5px dashed #000; margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 1.5px 0; vertical-align: top; }
      .tot { font-size: 15px; font-weight: bold; }
      .qrcode { text-align: center; margin: 6px 0; }
      .qrcode img { width: 46mm; height: 46mm; }
      .chave { font-size: 10.5px; word-break: break-all; text-align: center; }
      .homolog { border: 2px solid #000; text-align: center; font-weight: bold; padding: 2px; margin: 4px 0; font-size: 11px; }
      .small { font-size: 10.5px; }
      pre.cupom { display: none; }
    </style></head><body>
      ${homolog ? '<div class="homolog">AMBIENTE DE HOMOLOGAÇÃO<br>SEM VALOR FISCAL</div>' : ''}
      <h1>DANFE NFC-e</h1>
      <div class="c small">Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>
      <hr>
      <div class="c"><b>43 - EMITENTE</b></div>
      <div><b>SANDRA REGINA DE MENEZES PIRES</b><br>RINCAO LANCHES<br>CNPJ: 42.462.389/0001-37<br>IE: 1060172256<br>AVENIDA DOM PEDRO II, 1694 - UMBU<br>SANTANA DO LIVRAMENTO/RS - CEP 97577-372<br>Fone: (55) 98437-5004</div>
      <hr>
      <div class="c"><b>#${o.nfeNumber} - DESTINATÁRIO / CONSUMIDOR</b></div>
      <div class="small">CONSUMIDOR NÃO IDENTIFICADO${o.customerName ? ` - ${escapeHtml(o.customerName)}` : ''}</div>
      <hr>
      <table>${rows}${feeRow}</table>
      <hr>
      <table>
        <tr><td>SUBTOTAL</td><td class="r">${BRL(o.subtotal)}</td></tr>
        ${(o.discount || 0) > 0 ? `<tr><td>DESCONTO</td><td class="r">-${BRL(o.discount)}</td></tr>` : ''}
        <tr class="tot"><td>VALOR TOTAL</td><td class="r">${BRL(o.total)}</td></tr>
      </table>
      <hr>
      <div><b>PAGAMENTO:</b> ${payMap[o.payment] || escapeHtml(o.payment)}${o.payment === 'dinheiro' && o.changeFor > 0 ? ` (troco para ${BRL(o.changeFor)})` : ''}</div>
      <hr>
      <div class="c"><b>CONSULTA DE AUTENTICIDADE</b></div>
      <div class="chave">${chaveFmt}</div>
      <div class="small c">Protocolo de autorização: ${o.nfeProtocol || '-'}<br>Consulte pelo QR Code ou em www.sefaz.rs.gov.br/nfce/consulta</div>
      <div class="qrcode">${qr ? `<img id="nfe-qr" src="${qr}">` : ''}</div>
      <hr>
      <div class="small c">Rincao Lanches - Obrigado pela preferência!</div>
      <pre class="receipt cupom" id="danfe-cupom" data-fonte="1x1" data-qr="${escapeAttr(qrTexto)}">${escapeHtml(textoCupom)}</pre>
    </body></html>`;

    const w = window.open('', '_blank', 'width=420,height=720');
    // sem alert(): no app portatil a janela do sistema travava o teclado
    if (!w) return { ok: false, error: 'Permita pop-ups para imprimir o DANFE' };
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: 'Falha ao gerar o DANFE: ' + (e?.message || e) };
  }
}
