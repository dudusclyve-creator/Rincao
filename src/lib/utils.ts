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

export function receiptText(o: {
  store: string; number: number; date: string; customerName: string;
  customerPhone: string; items: { qty: number; name: string; unitPrice: number; addons: CartAddon[]; note?: string }[];
  payment: string; subtotal: number; fee: number; discount: number; total: number;
  addressText?: string; driverName?: string; motoboy?: string; changeFor?: number | null;
  type?: string; note?: string;
  width?: '58mm' | '80mm';
  variant?: 'full' | 'entregador';
}) {
  const cols = o.width === '58mm' ? 22 : 25;
  const line = '-'.repeat(cols);
  const c = (s: string) => s.slice(0, cols);
  const center = (s: string) => { const t = c(s); return ' '.repeat(Math.max(0, Math.floor((cols - t.length) / 2))) + t; };
  const row = (l: string, r: string) => {
    const sp = Math.max(1, cols - l.length - r.length);
    return c(l + ' '.repeat(sp) + r);
  };
  // quebra texto longo em varias linhas (nunca corta no meio)
  const wrapWords = (s: string, indent = ''): string[] => {
    const parts: string[] = [];
    let remaining = s;
    let first = true;
    while (remaining.length > (first ? cols : cols - indent.length)) {
      const limit = first ? cols : cols - indent.length;
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
  const rowWrap = (l: string, r: string) => {
    if (!r) return wrapWords(l);
    if (l.length + r.length + 1 <= cols) return [row(l, r)];
    return [...wrapWords(l, '  '), row('', r)];
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

  // endereco completo: a 1a linha precisa caber depois do prefixo "Endereco: "
  const wrapAddress = (addr: string) => {
    const out: string[] = [];
    let remaining = addr.trim();
    let prefix = 'Endereco: ';
    while (remaining.length > cols - prefix.length) {
      const limit = cols - prefix.length;
      let breakAt = remaining.lastIndexOf(', ', limit);
      const spaceAt = remaining.lastIndexOf(' ', limit);
      if (spaceAt > breakAt) breakAt = spaceAt;
      if (breakAt <= 0) breakAt = limit;
      out.push(prefix + remaining.slice(0, breakAt).trimEnd());
      remaining = remaining.slice(breakAt).replace(/^[, ]+/, '');
      prefix = '  ';
    }
    if (remaining || out.length === 0) out.push(prefix + remaining);
    return out;
  };

  const out: string[] = [];
  // retirada / consumo no local / balcao: sem linha de endereco e sem taxa de entrega
  const addrUp = (o.addressText || '').toUpperCase();
  const tipo = (o.type || '').toLowerCase();
  const semEndereco = tipo === 'retirada' || tipo === 'local' || tipo === 'balcao' || tipo === 'mesa' || /RETIRADA|CONSUMO NO LOCAL/.test(addrUp);
  // banner do tipo logo abaixo da logo (variante entregador = via do motorista)
  const driver = o.variant === 'entregador';
  const tipoTxt = driver ? 'ENTREGADOR'
    : tipo === 'mesa'
    ? (/^\d+$/.test((o.addressText || '').trim()) ? `MESA ${o.addressText}` : ((o.addressText || '').trim() ? o.addressText!.toUpperCase() : 'MESA'))
    : tipo === 'entrega' ? 'ENTREGA'
    : tipo === 'retirada' ? 'RETIRADA'
    : tipo === 'balcao' ? 'BALCÃO'
    : tipo === 'local' ? 'CONSUMO NO LOCAL'
    : tipo ? o.type!.toUpperCase() : '';
  if (tipoTxt) out.push(center(`=== ${tipoTxt} ===`));
  out.push(center(`*** ${o.store.toUpperCase()} ***`));
  out.push(c(`PEDIDO #${o.number}`));
  out.push(c(o.date));
  out.push('='.repeat(cols));
  const cli = `Cliente: ${o.customerName}${o.customerPhone ? ` ${o.customerPhone}` : ''}`;
  if (cli.length <= cols) out.push(c(cli));
  else {
    wrapWords(`Cliente: ${o.customerName}`, '  ').forEach((l) => out.push(l));
    if (o.customerPhone) out.push(c(`  ${o.customerPhone}`));
  }
  if (o.addressText && !semEndereco) {
    wrapAddress(o.addressText).forEach((l) => out.push(l));
  }
  if (o.driverName) wrapWords(`Entregador: ${o.driverName}${o.motoboy ? ` -> ${o.motoboy}` : ''}`, '  ').forEach((l) => out.push(l));
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
  out.push(row('Subtotal', BRL(o.subtotal)));
  if (!semEndereco && (tipo === 'entrega' || o.fee > 0)) out.push(row('Entrega', BRL(o.fee)));
  if (o.discount) out.push(row('Desconto', '-' + BRL(o.discount)));
  out.push(row('TOTAL', BRL(o.total)));
  if (driver) {
    // via do motorista: quanto cobrar e se ja esta pago
    const cashPart = (() => {
      const pay = String(o.payment || '');
      if (pay.includes(',')) return pay.split(',').filter((p) => p.startsWith('dinheiro:')).reduce((s, p) => s + Number(p.split(':')[1] || 0), 0);
      return pay === 'dinheiro' ? o.total : 0;
    })();
    if (cashPart > 0) {
      out.push(row('COBRAR', BRL(cashPart)));
      if (cashPart < o.total - 0.005) out.push(row('Resto ja pago', BRL(Math.max(0, o.total - cashPart))));
      if (troco > 0) {
        out.push(row('Recebido', BRL(o.changeFor!)));
        out.push(row('TROCO', BRL(troco)));
      }
    } else {
      out.push(c('JA PAGO - NAO COBRAR'));
      formatPayment(o.payment).forEach((l) => out.push(c(`  ${l}`)));
    }
  } else {
    out.push(c(o.payment?.includes(',') ? 'PAGAMENTO DIVIDIDO:' : 'PAGAMENTO:'));
    formatPayment(o.payment).forEach((l) => out.push(c(`  ${l}`)));
    if (troco > 0) {
      out.push(row('Recebido', BRL(o.changeFor!)));
      out.push(row('TROCO', BRL(troco)));
    }
  }
  out.push(line);
  if (!driver) {
    const bye = 'Obrigado pela preferencia!';
    if (bye.length <= cols) out.push(center(bye));
    else { out.push(center('Obrigado pela')); out.push(center('preferencia!')); }
  }
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
  const cols = o.width === '58mm' ? 22 : 25;
  const line = '-'.repeat(cols);
  const c = (s: string) => s.slice(0, cols);
  const center = (s: string) => { const t = c(s); return ' '.repeat(Math.max(0, Math.floor((cols - t.length) / 2))) + t; };
  const row = (l: string, r: string) => {
    const sp = Math.max(1, cols - l.length - r.length);
    return c(l + ' '.repeat(sp) + r);
  };
  const out: string[] = [];
  out.push(center(`*** ${o.store.toUpperCase()} ***`));
  out.push(center('FECHAMENTO DE CAIXA'));
  out.push('='.repeat(cols));
  out.push(row('Operador:', o.operator));
  out.push(c('Abertura:'));
  out.push(c(`  ${o.openedAt}`));
  out.push(c('Fechamento:'));
  out.push(c(`  ${o.closedAt}`));
  out.push(line);
  out.push(row('Valor inicial', BRL(o.initial)));
  out.push(row('Vendas', BRL(o.vendas)));
  if (o.orderNumbers && o.orderNumbers.length > 0) {
    out.push(c(`  Pedidos (#${o.orderNumbers[0]}-${o.orderNumbers[o.orderNumbers.length - 1]})`));
    out.push(c(`  Qtd: ${o.orderNumbers.length} pedido(s)`));
  }
  if (o.deliveryDayCount !== undefined) out.push(row('Entregas do dia', String(o.deliveryDayCount)));
  if (o.driverDay && o.driverDay.length > 0) {
    out.push(c('  Por motoboy (hoje):'));
    o.driverDay.forEach((d) => out.push(row(`    ${d.label}`, `${d.count}x ${BRL(d.fee)}`)));
  }
  if (o.entradas > 0) out.push(row('Suprimentos', BRL(o.entradas)));
  if (o.saidas > 0) out.push(row('Sangrias', '-' + BRL(o.saidas)));
  out.push(line);
  out.push(row('ESPERADO', BRL(o.expected)));
  out.push(row('INFORMADO', BRL(o.informed)));
  out.push(row('DIFERENCA', (o.diff >= 0 ? '+' : '') + BRL(o.diff)));
  out.push(row('So dinheiro', BRL(o.initial + o.entradas + (o.byMethod['dinheiro'] || 0) - o.saidas)));
  if (o.driverTotal && o.driverTotal > 0) {
    const pend = o.driverBreakdown && o.driverBreakdown.length > 0
      ? o.driverBreakdown.reduce((s, d) => s + Number(d.remaining || 0), 0)
      : Number(o.driverTotal);
    out.push(c('Taxas motoboy (a pagar):'));
    out.push(row('  pendente', BRL(pend)));
    (o.driverBreakdown || []).filter((d) => (d.remaining || 0) > 0).forEach((d) => {
      out.push(row(`    ${d.name}`, BRL(d.remaining)));
    });
  }
  out.push(line);
  out.push(c('Formas de pagamento:'));
  Object.entries(o.byMethod).forEach(([k, v]) => {
    out.push(row(`  ${k.toUpperCase()}`, BRL(v)));
  });
  out.push(line);
  out.push(center('Obrigado pela preferencia!'));
  return out.join('\n');
}

export function printReceiptText(text: string | string[], width: '58mm' | '80mm' = '80mm') {
  try {
    const pages = Array.isArray(text) ? text : [text];
    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return;
    const pagesHtml = pages.map((p, i) =>
      `<div class="pg"${i < pages.length - 1 ? ' style="page-break-after: always;"' : ''}><pre class="receipt">${p}</pre></div>`
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
    // carrega o logo do restaurante e imprime quando chegar
    fetch('/api/settings').then((r) => r.json()).then((s: any) => {
      const raw = s && s.logoUrl;
      const url = raw && typeof raw === 'string' && raw.startsWith('/') ? window.location.origin + raw : raw;
      const img = w.document.getElementById('logo') as HTMLImageElement | null;
      if (!url || !img) return;
      img.onload = () => { img.style.display = 'block'; clearTimeout(fallback); setTimeout(doPrint, 250); };
      img.onerror = () => { try { img.remove(); } catch {} };
      img.src = url;
    }).catch(() => {});
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
