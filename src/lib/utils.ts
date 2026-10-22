export const BRL = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const ORDER_STATUS: Record<string, string> = {
  novo: 'NOVOS',
  confirmado: 'CONFIRMADOS',
  preparo: 'EM PREPARAÇÃO',
  pronto: 'PRONTO',
  entrega: 'SAIU PARA ENTREGA',
  concluido: 'CONCLUÍDO',
  cancelado: 'CANCELADO',
};

export const STATUS_ORDER = ['novo','confirmado','preparo','pronto','entrega','concluido','cancelado'];

export function isOpenNow(hoursJson: string, manual?: boolean | null, ref = new Date()): boolean {
  if (manual === true) return true;
  if (manual === false) return false;
  try {
    const h = JSON.parse(hoursJson || '{}');
    if (!Object.keys(h).length) return true; // sem config = aberto
    const keys = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const t = (s: string) => { const [hh, mm] = s.split(':').map(Number); return hh * 60 + mm; };
    const inRanges = (ranges: string[], cur: number) =>
      (ranges || []).some((r) => {
        const [a, b] = r.split('-');
        const s = t(a), e = t(b);
        if (e <= s) return cur >= s || cur <= e; // atravessa a meia-noite
        return cur >= s && cur <= e;
      });
    const cur = ref.getHours() * 60 + ref.getMinutes();
    const today = keys[ref.getDay()];
    if (inRanges(h[today] || [], cur)) return true;
    // madrugada: vale o turno da véspera que atravessa a meia-noite
    if (cur < 6 * 60) {
      const prev = keys[(ref.getDay() + 6) % 7];
      if ((h[prev] || []).some((r: string) => {
        const [a, b] = r.split('-');
        return t(b) <= t(a) && cur <= t(b);
      })) return true;
    }
    return false;
  } catch { return true; }
}

export type CartAddon = { name: string; price: number; qty?: number };
export type CartItem = {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note: string;
  addons: CartAddon[];
};

export function buildWhatsMessage(o: {
  number: number; customerName: string; customerPhone: string;
  items: { qty: number; name: string; addons: CartAddon[] }[];
  note: string; addressText: string; payment: string;
  subtotal: number; deliveryFee: number; discount: number; total: number;
}) {
  const L: string[] = [];
  L.push(`*NOVO PEDIDO #${o.number}*`);
  L.push('');
  L.push(`Cliente: ${o.customerName}`);
  L.push(`Telefone: ${o.customerPhone}`);
  L.push('');
  L.push('*ITENS:*');
  o.items.forEach((it) => {
    L.push(`${it.qty}x ${it.name}`);
    it.addons.forEach((a) => L.push(`• ${a.name}${a.price ? ` (+${BRL(a.price)})` : ''}`));
    L.push('');
  });
  if (o.note) { L.push('*OBSERVAÇÃO:*'); L.push(o.note); L.push(''); }
  L.push('*ENTREGA:*');
  L.push(o.addressText || 'Retirada / consumo no local');
  L.push('');
  L.push(`*PAGAMENTO:* ${o.payment.toUpperCase()}`);
  L.push('');
  L.push(`Subtotal: ${BRL(o.subtotal)}`);
  L.push(`Entrega: ${BRL(o.deliveryFee)}`);
  if (o.discount) L.push(`Desconto: -${BRL(o.discount)}`);
  L.push(`*TOTAL: ${BRL(o.total)}*`);
  return L.join('\n');
}

// ---- Impressão térmica (ESC/POS texto + HTML) ----
// mascara de CPF: 000.000.000-00
export function maskCpf(v: string) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ---- Telefone (Brasil DDI 55 e Uruguai +598) ----
function fmtBR(d: string) {
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// mascara de telefone: aceita BR ((DD) 99999-9999 / +55 ...) e UY (+598 99 123 456)
export function maskPhone(v: string) {
  const raw = String(v || '');
  const plus = /^\s*\+/.test(raw);
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  // Uruguai: 598..., 00598... (00 ja removido) ou 09xx xxx xxx (formato local)
  if (d.startsWith('598') || (d.startsWith('09') && d.length <= 10)) {
    const n = (d.startsWith('598') ? d.slice(3) : d.slice(1)).slice(0, 8);
    let out = '+598';
    if (n.length > 0) out += ' ' + n.slice(0, 2);
    if (n.length > 2) out += ' ' + n.slice(2, 5);
    if (n.length > 5) out += ' ' + n.slice(5, 8);
    return out;
  }
  // Brasil com DDI (+55 ... ou 55 + DDD + numero = 12+ digitos)
  if ((plus && d.startsWith('55')) || (d.startsWith('55') && d.length > 11)) {
    const n = d.slice(2, 13);
    return n ? `+55 ${fmtBR(n)}` : '+55';
  }
  if (plus) return '+' + d.slice(0, 15);
  return fmtBR(d.slice(0, 11));
}

// normaliza para o formato internacional do wa.me (sem +)
export function waNumber(phone: string) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('598')) return d.slice(0, 11);
  if (d.startsWith('09') && d.length <= 10) return ('598' + d.slice(1)).slice(0, 11);
  if (d.startsWith('55') && d.length >= 12) return d.slice(0, 13);
  if (d.length === 8) return '598' + d;
  if (d.length >= 10) return '55' + d;
  return d;
}

// exibicao amigavel: BR (DD) 99999-9999 / +55 (DD) ... / UY +598 99 123 456
export function formatPhone(p: string) {
  const raw = String(p || '');
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('598') && d.length >= 10) {
    const n = d.slice(3, 11);
    let out = '+598 ' + n.slice(0, 2);
    if (n.length > 2) out += ' ' + n.slice(2, 5);
    if (n.length > 5) out += ' ' + n.slice(5, 8);
    return out;
  }
  if (d.startsWith('55') && d.length >= 12) return `+55 ${fmtBR(d.slice(2, 13))}`;
  if (d.length === 10 || d.length === 11) return fmtBR(d);
  return raw || '—';
}

export function receiptText(o: {
  store: string; number: number; date: string; customerName: string;
  customerPhone: string; items: { qty: number; name: string; unitPrice: number; addons: CartAddon[]; note?: string }[];
  payment: string; subtotal: number; fee: number; discount: number; total: number;
  cardFee?: number; cardFeeLabel?: string;
  addressText?: string; driverName?: string; motoboy?: string; changeFor?: number | null;
  type?: string; note?: string;
  width?: '58mm' | '80mm';
}) {
  const cols = o.width === '58mm' ? 22 : 24;               // largura da comanda (fonte 2x)
  const line = '-'.repeat(cols);
  const c = (s: string, w = cols) => s.slice(0, w);
  const center = (s: string, w = cols) => { const t = c(s, w); return ' '.repeat(Math.max(0, Math.floor((w - t.length) / 2))) + t; };
  const row = (l: string, r: string, w = cols) => {
    const sp = Math.max(1, w - l.length - r.length);
    return c(l + ' '.repeat(sp) + r, w);
  };
  // quebra texto longo em varias linhas (nunca corta no meio)
  const wrapWords = (s: string, indent = '', w = cols): string[] => {
    const parts: string[] = [];
    let remaining = s;
    let first = true;
    while (remaining.length > (first ? w : w - indent.length)) {
      const limit = first ? w : w - indent.length;
      let breakAt = remaining.lastIndexOf(', ', limit);
      const spaceAt = remaining.lastIndexOf(' ', limit);
      if (spaceAt > breakAt) breakAt = spaceAt;
      if (breakAt <= 0) breakAt = limit;
      parts.push((first ? '' : indent) + remaining.slice(0, breakAt).trimEnd());
      remaining = remaining.slice(breakAt).replace(/^[, ]+/, '');
      first = false;
    }
    if (remaining || first) parts.push((first ? '' : indent) + remaining);
    return parts;
  };
  const rowWrap = (l: string, r: string, w = cols) => {
    if (!r) return wrapWords(l, '', w);
    if (l.length + r.length + 1 <= w) return [row(l, r, w)];
    return [...wrapWords(l, '  ', w), row('', r, w)];
  };

  const formatPayment = (pay: string) => {
    if (!pay) return ['A definir'];
    const map: Record<string, string> = { pix: 'PIX', dinheiro: 'Dinheiro', debito: 'Debito', credito: 'Credito' };
    if (pay.includes(',')) {
      return pay.split(',').map(p => {
        const [method, amount] = p.split(':');
        return `${map[method] || method} ${BRL(Number(amount))}`;
      });
    }
    return [`${map[pay] || pay} ${BRL(o.total)}`];
  };

  const troco = (() => {
    if (!o.changeFor || o.changeFor <= 0) return 0;
    if (o.payment?.includes(',')) {
      const cashAmount = o.payment.split(',').filter(p => p.startsWith('dinheiro:')).reduce((s, p) => s + Number(p.split(':')[1] || 0), 0);
      return Math.max(0, o.changeFor - cashAmount);
    }
    return o.payment === 'dinheiro' ? Math.max(0, o.changeFor - o.total) : 0;
  })();

  // endereco: separa em partes ("rua" / "numero + complemento" / "bairro, cidade")
  const partesEndereco = (addr: string): string[] => {
    const txt = addr.trim();
    const m = txt.match(/^(.+?),\s*([^,]+?)(?:\s*-\s*([^,]+?))?\s*-\s*(.+)$/);
    if (m) {
      const numero = m[2].trim();
      const complemento = (m[3] || '').trim();
      return [m[1].trim(), complemento ? `${numero} - ${complemento}` : numero, m[4].trim()].filter(Boolean);
    }
    const partes = txt.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
    return partes.length > 1 ? partes : [txt];
  };
  // quebra um texto em linhas de ate "cols" colunas; as continuacoes levam recuo
  const linhasComRecuo = (txt: string, recuo: string, indentarPrimeira = false): string[] => {
    const res: string[] = [];
    let resto = txt.trim();
    let primeira = true;
    const prefixo = () => (primeira && !indentarPrimeira ? '' : recuo);
    while (resto.length > cols - prefixo().length) {
      const limite = cols - prefixo().length;
      let corte = resto.lastIndexOf(', ', limite);
      const espaco = resto.lastIndexOf(' ', limite);
      if (espaco > corte) corte = espaco;
      if (corte <= 0) corte = limite;
      res.push(prefixo() + resto.slice(0, corte).trimEnd());
      resto = resto.slice(corte).replace(/^[, ]+/, '');
      primeira = false;
    }
    if (resto.length) res.push(prefixo() + resto);
    return res;
  };

  const out: string[] = [];
  // retirada / consumo no local / balcao: sem linha de endereco e sem taxa de entrega
  const addrUp = (o.addressText || '').toUpperCase();
  const tipo = (o.type || '').toLowerCase();
  const semEndereco = tipo === 'retirada' || tipo === 'local' || tipo === 'balcao' || tipo === 'mesa' || /RETIRADA|CONSUMO NO LOCAL/.test(addrUp);
  // banner do tipo logo abaixo da logo
  const tipoTxt = tipo === 'mesa'
    ? (/^\d+$/.test((o.addressText || '').trim()) ? `MESA ${o.addressText}` : ((o.addressText || '').trim() ? o.addressText!.toUpperCase() : 'MESA'))
    : tipo === 'entrega' ? 'ENTREGA'
    : tipo === 'retirada' ? 'RETIRADA'
    : tipo === 'balcao' ? 'BALCÃO'
    : tipo === 'local' ? 'CONSUMO NO LOCAL'
    : tipo ? o.type!.toUpperCase() : '';
  if (tipoTxt) out.push(center(`=== ${tipoTxt} ===`));
  out.push(center(`*** ${o.store.toUpperCase()} ***`));
  out.push(c(o.date));
  out.push('='.repeat(cols));

  // cliente: o WhatsApp dele vem logo abaixo do nome (antes ficava depois do
  // entregador e parecia ser o numero do motoboy)
  wrapWords(`Cliente: ${o.customerName}`, '  ').forEach((l) => out.push(l));
  if (o.customerPhone) {
    // numero na MESMA linha do rotulo: sem o espaco depois do DDD ele cabe
    const wa = `WhatsApp: ${formatPhone(o.customerPhone).replace(/\)\s+/, ')')}`;
    if (wa.length <= cols) out.push(c(wa));
    else { out.push(c('WhatsApp:')); out.push(c(`  ${formatPhone(o.customerPhone)}`)); }
  }

  // endereco: "End: Rua X, 123" na mesma linha; o resto alinhado embaixo
  if (o.addressText && !semEndereco) {
    const partes = partesEndereco(o.addressText);
    linhasComRecuo(`End: ${partes[0] || ''}`, '  ').forEach((l) => out.push(c(l)));
    partes.slice(1).forEach((parte) => {
      linhasComRecuo(parte, '  ', true).forEach((l) => out.push(c(l)));
    });
  }

  const entregador = (o.driverName || o.motoboy || '').trim();
  if (entregador) wrapWords(`Entregador: ${entregador}`, '  ').forEach((l) => out.push(l));

  // itens e valores na mesma letra da comanda (2x), menos o numero do pedido
  out.push(line);
  o.items.forEach((it) => {
    rowWrap(`${it.qty}x ${it.name}`, BRL(it.unitPrice * it.qty)).forEach((l) => out.push(l));
    it.addons.forEach((a) => {
      const left = `  + ${a.name}${a.qty && a.qty > 1 ? ` ${a.qty}x` : ''}`;
      rowWrap(left, a.price ? BRL(a.price) : '').forEach((l) => out.push(l));
    });
    if (it.note) wrapWords(`  obs: ${it.note}`, '  ').forEach((l) => out.push(l));
  });
  if (o.note) wrapWords(`OBS: ${o.note}`, '  ').forEach((l) => out.push(l));
  out.push(line);
  rowWrap('Subtotal', BRL(o.subtotal)).forEach((l) => out.push(l));
  if (!semEndereco && (tipo === 'entrega' || o.fee > 0)) rowWrap('Entrega', BRL(o.fee)).forEach((l) => out.push(l));
  if (o.discount) rowWrap('Desconto', '-' + BRL(o.discount)).forEach((l) => out.push(l));
  if (o.cardFee && o.cardFee > 0) rowWrap(o.cardFeeLabel || 'Taxa cartao', BRL(o.cardFee)).forEach((l) => out.push(l));
  rowWrap('TOTAL', BRL(o.total)).forEach((l) => out.push(l));
  const pagamentos = formatPayment(o.payment);
  const rotuloPag = o.payment?.includes(',') ? 'PAGAMENTO DIVIDIDO:' : 'PAGAMENTO:';
  if (pagamentos.length === 1) {
    // tudo na mesma linha ("PAGAMENTO: PIX R$ 72,90")
    linhasComRecuo(`${rotuloPag} ${pagamentos[0]}`, '  ').forEach((l) => out.push(c(l)));
  } else {
    out.push(c(rotuloPag));
    pagamentos.forEach((l) => out.push(c(`  ${l}`)));
  }
  if (troco > 0) {
    rowWrap('Recebido', BRL(o.changeFor!)).forEach((l) => out.push(l));
    rowWrap('TROCO', BRL(troco)).forEach((l) => out.push(l));
  }
  out.push(line);
  const bye = 'Obrigado pela preferencia!';
  if (bye.length <= cols) out.push(center(bye));
  else { out.push(center('Obrigado pela')); out.push(center('preferencia!')); }
  // numero do pedido em destaque, no rodape: a impressora termica reconhece esta
  // ultima linha ("PEDIDO #123") e imprime em letra grande, centralizada.
  out.push('');
  out.push(center(`PEDIDO #${o.number}`));
  return out.join('\n');
}

export function cashReceiptText(o: {
  store: string; operator: string; openedAt: string; closedAt: string;
  initial: number; vendas: number; entradas: number; saidas: number; expected: number;
  informed: number; diff: number; byMethod: Record<string, number>; width?: '58mm' | '80mm';
  driverTotal?: number;
  orderNumbers?: number[];
  driverBreakdown?: { name: string; total: number; paid: number; remaining: number }[];
  deliveryDayCount?: number;
  driverDay?: { label: string; count: number; fee: number }[];
}) {
  const cols = o.width === '58mm' ? 22 : 24;
  const line = '-'.repeat(cols);
  const c = (s: string) => s.slice(0, cols);
  const center = (s: string) => { const t = c(s); return ' '.repeat(Math.max(0, Math.floor((cols - t.length) / 2))) + t; };
  const row = (l: string, r: string) => {
    const sp = Math.max(1, cols - l.length - r.length);
    return c(l + ' '.repeat(sp) + r);
  };
  // valor nunca corta: se nao couber na linha, sai inteiro na linha seguinte
  const rowWrap = (l: string, r: string): string[] => {
    if (!r) return [c(l)];
    if (l.length + r.length + 1 <= cols) return [row(l, r)];
    return [c(l), c(`  ${r}`)];
  };
  const out: string[] = [];
  out.push(center(`*** ${o.store.toUpperCase()} ***`));
  out.push(center('FECHAMENTO DE CAIXA'));
  out.push('='.repeat(cols));
  rowWrap('Operador:', o.operator).forEach((l) => out.push(l));
  out.push(c('Abertura:'));
  out.push(c(`  ${o.openedAt}`));
  out.push(c('Fechamento:'));
  out.push(c(`  ${o.closedAt}`));
  out.push(line);
  rowWrap('Valor inicial', BRL(o.initial)).forEach((l) => out.push(l));
  rowWrap('Vendas', BRL(o.vendas)).forEach((l) => out.push(l));
  if (o.orderNumbers && o.orderNumbers.length > 0) {
    out.push(c(`  Pedidos (#${o.orderNumbers[0]}-${o.orderNumbers[o.orderNumbers.length - 1]})`));
    out.push(c(`  Qtd: ${o.orderNumbers.length} pedido(s)`));
  }
  if (o.deliveryDayCount !== undefined) rowWrap('Entregas do dia', String(o.deliveryDayCount)).forEach((l) => out.push(l));
  if (o.driverDay && o.driverDay.length > 0) {
    out.push(c('  Por motoboy (hoje):'));
    o.driverDay.forEach((d) => rowWrap(`    ${d.label}`, `${d.count}x ${BRL(d.fee)}`).forEach((l) => out.push(l)));
  }
  if (o.entradas > 0) rowWrap('Suprimentos', BRL(o.entradas)).forEach((l) => out.push(l));
  if (o.saidas > 0) rowWrap('Sangrias', '-' + BRL(o.saidas)).forEach((l) => out.push(l));
  out.push(line);
  rowWrap('ESPERADO', BRL(o.expected)).forEach((l) => out.push(l));
  rowWrap('INFORMADO', BRL(o.informed)).forEach((l) => out.push(l));
  rowWrap('DIFERENCA', (o.diff >= 0 ? '+' : '') + BRL(o.diff)).forEach((l) => out.push(l));
  rowWrap('So dinheiro', BRL(o.initial + o.entradas + (o.byMethod['dinheiro'] || 0) - o.saidas)).forEach((l) => out.push(l));
  if (o.driverTotal && o.driverTotal > 0) {
    const pend = o.driverBreakdown && o.driverBreakdown.length > 0
      ? o.driverBreakdown.reduce((s, d) => s + Number(d.remaining || 0), 0)
      : Number(o.driverTotal);
    out.push(c('Taxas motoboy (a pagar):'));
    rowWrap('  pendente', BRL(pend)).forEach((l) => out.push(l));
    (o.driverBreakdown || []).filter((d) => (d.remaining || 0) > 0).forEach((d) => {
      rowWrap(`    ${d.name}`, BRL(d.remaining)).forEach((l) => out.push(l));
    });
  }
  out.push(line);
  out.push(c('Formas de pagamento:'));
  Object.entries(o.byMethod).forEach(([k, v]) => {
    rowWrap(`  ${k.toUpperCase()}`, BRL(v)).forEach((l) => out.push(l));
  });
  out.push(line);
  out.push(center('Obrigado pela preferencia!'));
  return out.join('\n');
}

export function printReceiptText(
  text: string | string[],
  width: '58mm' | '80mm' = '80mm',
  // fonte usada na termica (o app le o data-fonte da 1a via). 2x2 = letra grande.
  opts: { fonte?: '1x1' | '2x1' | '1x2' | '2x2' } = {},
) {
  try {
    const pages = Array.isArray(text) ? text : [text];
    const fonte = opts.fonte || '';
    const alta = fonte.endsWith('2');
    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return;
    // a ultima linha do cupom ("PEDIDO #123") sai grande e centralizada tambem
    // no navegador. Na impressora termica quem faz isso e o scripts/rawprint.ps1
    // (o texto continua sendo "PEDIDO #123", so muda o visual aqui).
    const marcarPedido = (p: string) => {
      const linhas = p.split('\n');
      for (let i = linhas.length - 1; i >= 0; i--) {
        const t = linhas[i].trim();
        if (!t) continue;
        if (/^PEDIDO\s*#?\s*\d+$/i.test(t)) linhas[i] = `<span class="pedido">${t}</span>`;
        break;
      }
      return linhas.join('\n');
    };
    // troca as marcas de fonte do cupom por trechos menores no navegador
    const trocarFonte = (p: string) => p
      .replace(/^[ \t]*\[\[FONTE:1\]\][ \t]*\r?\n/gm, '<span class="miudo">')
      .replace(/^[ \t]*\[\[FONTE:2\]\][ \t]*\r?\n/gm, '</span>');
    const pagesHtml = pages.map((p, i) =>
      `<div class="pg"${i < pages.length - 1 ? ' style="page-break-after: always;"' : ''}><pre class="receipt${alta ? ' alta' : ''}"${fonte ? ` data-fonte="${fonte}"` : ''}>${marcarPedido(trocarFonte(p))}</pre></div>`
    ).join('\n');
    w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Impressao</title>
<style>
  @page { size: ${width} auto; margin: 4mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .logobox { text-align: center; margin: 0 0 2mm; }
  #logo { display: none; max-width: 55mm; max-height: 24mm; margin: 0 auto; }
  pre.receipt {
    font-family: 'Courier New', 'Liberation Mono', monospace;
    font-size: ${width === '58mm' ? 14 : 18}px;
    font-weight: 700;
    line-height: 1.5;
    margin: 0;
    padding: 0;
    white-space: pre;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  pre.receipt .pedido {
    display: block;
    font-size: 1.6em;
    line-height: 1.2;
    font-weight: 900;
    text-align: center;
    letter-spacing: 1px;
  }
  /* fonte 2x2 na termica: mesma largura, o dobro de altura */
  pre.receipt.alta { line-height: 2.15; }
  pre.receipt .miudo {
    font-size: 0.56em;
    line-height: 2.6;
  }
  @media screen {
    body { padding: 12px; background: #f0f0f0; }
    .logobox, pre.receipt { background: #fff; width: 330px; margin-left: auto; margin-right: auto; }
    pre.receipt { padding: 12px; white-space: pre-wrap; box-shadow: 0 1px 6px rgba(0,0,0,0.2); }
    .logobox { padding-top: 12px; box-shadow: 0 1px 6px rgba(0,0,0,0.2); }
    div.pg { margin-bottom: 14px; }
  }
</style></head>
<body>
<div class="logobox"><img id="logo" alt="" /></div>
${pagesHtml}
</body></html>`);
    w.document.close();

    const doPrint = () => {
      if (!(w as any).__printed) { (w as any).__printed = true; setTimeout(() => { try { w.print(); } catch {} }, 150); }
    };
    // fallback: imprime mesmo que o logo demore
    const fallback = setTimeout(doPrint, 1400);
    // O cupom usa a versao clara da logo (public/logo-cupom.png): a logo colorida
    // sairia como um bloco escuro no papel termico.
    const img = w.document.getElementById('logo') as HTMLImageElement | null;
    if (img) {
      img.onload = () => { img.style.display = 'block'; clearTimeout(fallback); setTimeout(doPrint, 250); };
      img.onerror = () => { try { img.remove(); } catch {} };
      img.src = window.location.origin + '/logo-cupom.png';
    }
  } catch {}
}

export function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f;
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.16);
    });
  } catch {}
}

let _dropAudio: HTMLAudioElement | null = null;
let _menuAudio: HTMLAudioElement | null = null;
let _cashAudio: HTMLAudioElement | null = null;
let _storeCloseAudio: HTMLAudioElement | null = null;

function getAudio(cache: HTMLAudioElement | null, src: string, vol: number): HTMLAudioElement {
  if (!cache) {
    cache = new Audio(src);
    cache.volume = vol;
    cache.preload = 'auto';
    cache.load();
  }
  cache.currentTime = 0;
  return cache;
}

export function preloadSounds() {
  try {
    _dropAudio = getAudio(null, '/drop.mp3', 0.6);
    _menuAudio = getAudio(null, '/menu-click.mp3', 0.5);
    _cashAudio = getAudio(null, '/cash-register.mp3', 0.7);
    _storeCloseAudio = getAudio(null, '/store-closed.mp3', 0.7);
  } catch {}
}

export function playDropSound() {
  try {
    _dropAudio = getAudio(_dropAudio, '/drop.mp3', 0.6);
    _dropAudio.play().catch(() => {});
  } catch {}
}

export function playMenuClick() {
  try {
    _menuAudio = getAudio(_menuAudio, '/menu-click.mp3', 0.5);
    _menuAudio.play().catch(() => {});
  } catch {}
}

export function playCashSound() {
  try {
    _cashAudio = getAudio(_cashAudio, '/cash-register.mp3', 0.7);
    _cashAudio.play().catch(() => {});
  } catch {}
}

export function playStoreCloseSound() {
  try {
    _storeCloseAudio = getAudio(_storeCloseAudio, '/store-closed.mp3', 0.7);
    _storeCloseAudio.play().catch(() => {});
  } catch {}
}

// Toast system
type ToastType = 'success' | 'error' | 'info' | 'warning';
let _toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, type: ToastType = 'info', duration = 3000) {
  if (_toastTimeout) clearTimeout(_toastTimeout);
  const existing = document.getElementById('global-toast');
  if (existing) existing.remove();

  const colors: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#22c55e', icon: '✓' },
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#ef4444', icon: '✕' },
    info: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6', icon: 'ℹ' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b', icon: '⚠' },
  };
  const c = colors[type];

  const el = document.createElement('div');
  el.id = 'global-toast';
  el.style.cssText = `position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;background:${c.bg};border:1px solid ${c.border};color:${c.text};padding:10px 20px;border-radius:12px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:slideDown 0.3s ease;font-family:system-ui;`;
  el.innerHTML = `<span style="font-size:14px">${c.icon}</span>${msg}`;
  document.body.appendChild(el);

  _toastTimeout = setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, duration);
}
