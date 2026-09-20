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
export function receiptText(o: {
  store: string; number: number; date: string; customerName: string;
  customerPhone: string; items: { qty: number; name: string; addons: CartAddon[]; note?: string }[];
  payment: string; subtotal: number; fee: number; discount: number; total: number;
  addressText?: string; driverName?: string; changeFor?: number | null;
  width?: '58mm' | '80mm';
}) {
  const cols = o.width === '58mm' ? 32 : 48;
  const line = '-'.repeat(cols);
  const c = (s: string) => s.slice(0, cols);
  const row = (l: string, r: string) => {
    const sp = Math.max(1, cols - l.length - r.length);
    return c(l + ' '.repeat(sp) + r);
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

  const wrapAddress = (addr: string) => {
    if (addr.length <= cols) return [addr];
    const parts: string[] = [];
    let remaining = addr;
    while (remaining.length > cols) {
      let breakAt = remaining.lastIndexOf(', ', cols);
      if (breakAt <= 0) breakAt = remaining.lastIndexOf(' ', cols);
      if (breakAt <= 0) breakAt = cols;
      parts.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).replace(/^[, ]+/, '');
    }
    if (remaining) parts.push(remaining);
    return parts;
  };

  const out: string[] = [];
  out.push(c(`*** ${o.store} ***`));
  out.push(row(`PEDIDO #${o.number}`, o.date));
  out.push(line);
  out.push(`Cliente: ${o.customerName}${o.customerPhone ? ` ${o.customerPhone}` : ''}`);
  if (o.addressText) {
    wrapAddress(o.addressText).forEach((part, i) => {
      out.push(i === 0 ? c(`Endereco: ${part}`) : c(`  ${part}`));
    });
  }
  if (o.driverName) out.push(`Entregador: ${o.driverName}`);
  out.push(line);
  o.items.forEach((it) => {
    out.push(row(`${it.qty}x ${it.name}`, BRL(it.unitPrice * it.qty)));
    it.addons.forEach((a) => out.push(c(`  + ${a.name}${a.price ? ` ${BRL(a.price)}` : ''}`)));
    if (it.note) out.push(c(`  obs: ${it.note}`));
  });
  out.push(line);
  out.push(row('Subtotal', BRL(o.subtotal)));
  out.push(row('Entrega', BRL(o.fee)));
  if (o.discount) out.push(row('Desconto', '-' + BRL(o.discount)));
  out.push(row('TOTAL', BRL(o.total)));
  out.push(c(o.payment?.includes(',') ? 'PAGAMENTO DIVIDIDO:' : 'PAGAMENTO:'));
  formatPayment(o.payment).forEach((line) => out.push(c(`  ${line}`)));
  if (troco > 0) out.push(row('TROCO', `${BRL(o.changeFor!)} - devolver ${BRL(troco)}`));
  out.push(line);
  out.push(c('Obrigado pela preferencia!'));
  return out.join('\n');
}

export function cashReceiptText(o: {
  store: string; operator: string; openedAt: string; closedAt: string;
  initial: number; vendas: number; entradas: number; saidas: number; expected: number;
  informed: number; diff: number; byMethod: Record<string, number>; width?: '58mm' | '80mm';
  driverTotal?: number;
  orderNumbers?: number[];
  driverBreakdown?: { name: string; total: number; paid: number; remaining: number }[];
}) {
  const cols = o.width === '58mm' ? 32 : 48;
  const line = '-'.repeat(cols);
  const c = (s: string) => s.slice(0, cols);
  const row = (l: string, r: string) => {
    const sp = Math.max(1, cols - l.length - r.length);
    return c(l + ' '.repeat(sp) + r);
  };
  const out: string[] = [];
  out.push(c(`*** ${o.store} ***`));
  out.push(c('FECHAMENTO DE CAIXA'));
  out.push(row('Operador:', o.operator));
  out.push(row('Abertura:', o.openedAt));
  out.push(row('Fechamento:', o.closedAt));
  out.push(line);
  out.push(row('Valor inicial', BRL(o.initial)));
  out.push(row('Vendas', BRL(o.vendas)));
  if (o.orderNumbers && o.orderNumbers.length > 0) {
    out.push(c(`  Pedidos (#${o.orderNumbers[0]}-${o.orderNumbers[o.orderNumbers.length - 1]})`));
    out.push(c(`  Qtd: ${o.orderNumbers.length} pedido(s)`));
  }
  if (o.entradas > 0) out.push(row('Suprimentos', BRL(o.entradas)));
  if (o.saidas > 0) out.push(row('Sangrias', '-' + BRL(o.saidas)));
  if (o.driverTotal && o.driverTotal > 0) {
    out.push(row('Motoboys', '-' + BRL(o.driverTotal)));
    if (o.driverBreakdown && o.driverBreakdown.length > 0) {
      o.driverBreakdown.forEach((d) => {
        out.push(row(`  ${d.name}`, BRL(d.total)));
      });
    }
  }
  out.push(line);
  out.push(row('ESPERADO', BRL(o.expected)));
  out.push(row('INFORMADO', BRL(o.informed)));
  out.push(row('DIFERENCA', (o.diff >= 0 ? '+' : '') + BRL(o.diff)));
  out.push(line);
  out.push(c('Formas de pagamento:'));
  Object.entries(o.byMethod).forEach(([k, v]) => {
    out.push(row(`  ${k.toUpperCase()}`, BRL(v)));
  });
  out.push(line);
  out.push(c('Obrigado pela preferencia!'));
  return out.join('\n');
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

export function playDropSound() {
  try {
    const audio = new Audio('/drop.mp3');
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}
}
