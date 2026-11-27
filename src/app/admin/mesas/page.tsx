'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { BRL, playDropSound, showToast, norm } from '@/lib/utils';
import { useScrollRail } from '@/lib/useScrollRail';
import { ItemCard } from '@/components/ItemCard';
import QRCode from 'qrcode';
import {
  Users, Plus, Minus, X, Search, ArrowRightLeft, Receipt,
  User, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CreditCard, Banknote, Smartphone,
  Check, Trash2, QrCode, Map, LayoutGrid, Pencil, Save, Wand2, Armchair
} from 'lucide-react';

const PAYMENT_OPTIONS = [
  { id: 'pix', label: 'PIX', icon: Smartphone, color: '#22c55e' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: '#f59e0b' },
  { id: 'debito', label: 'Débito', icon: CreditCard, color: '#3b82f6' },
  { id: 'credito', label: 'Crédito', icon: CreditCard, color: '#8b5cf6' },
];

// ---- vista aérea do salão -------------------------------------------------
// As mesas são posicionadas num canvas virtual fixo (1200x760) e o front
// converte tudo para % — assim o desenho fica igual em qualquer tela.
const CANVAS_W = 1200;
const CANVAS_H = 760;

const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(v)));

function autoLayoutTables(list: any[]) {
  const n = list.length;
  if (!n) return list;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gapX = CANVAS_W / (cols + 1);
  const gapY = CANVAS_H / (rows + 1);
  return list.map((t: any, i: number) => {
    // mesas que nunca foram redimensionadas (120 padrão) ganham um tampo um
    // pouco maior na primeira organização, para o desenho ficar legível
    const w = Number(t.width) && Number(t.width) !== 120 ? Number(t.width) : 150;
    const h = Number(t.height) && Number(t.height) !== 120 ? Number(t.height) : 150;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      ...t,
      width: w,
      height: h,
      posX: Math.round(gapX * (col + 1) - w / 2),
      posY: Math.round(gapY * (row + 1) - h / 2),
      shape: t.shape || 'square',
      rotation: Number(t.rotation) || 0,
      seats: typeof t.seats === 'number' ? t.seats : 4,
    };
  });
}

// mesas antigas (sem posição salva) ganham uma grade automática só na tela;
// o desenho é gravado quando o usuário salva o layout.
const needsAutoLayout = (list: any[]) =>
  list.length > 0 && list.every((t: any) => !t.posX && !t.posY);

function firstFreeSpot(list: any[]) {
  const size = 170;
  for (let y = 30; y < CANVAS_H - 150; y += size) {
    for (let x = 30; x < CANVAS_W - 150; x += size) {
      const free = !list.some((t: any) => {
        const tx = Number(t.posX) || 0;
        const ty = Number(t.posY) || 0;
        const tw = Number(t.width) || 150;
        const th = Number(t.height) || 150;
        return x < tx + tw + 20 && x + 150 + 20 > tx && y < ty + th + 20 && y + 150 + 20 > ty;
      });
      if (free) return { x, y };
    }
  }
  return { x: Math.round(CANVAS_W / 2 - 75), y: Math.round(CANVAS_H / 2 - 75) };
}


function itemTotal(it: any) {
  const addons = typeof it.addonsJson === 'string' ? JSON.parse(it.addonsJson || '[]') : (it.addons || []);
  return it.qty * (it.unitPrice + addons.reduce((s: number, a: any) => s + (a.price || 0) * (a.qty || 1), 0));
}

function ProductModal({ product, onClose, onAdd }: { product: any; onClose: () => void; onAdd: (item: any) => void }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [sel, setSel] = useState<Record<string, { name: string; price: number; qty: number }[]>>({});
  const groups = product.groups?.map((g: any) => g.group) || [];
  const price = product.promoPrice ?? product.price;

  const toggle = (g: any, a: any) => {
    const cur = sel[g.id] || [];
    const has = cur.find((x) => x.name === a.name);
    let next: { name: string; price: number; qty: number }[];
    if (has) next = cur.filter((x) => x.name !== a.name);
    else {
      if (cur.reduce((s, x) => s + (x.qty || 1), 0) + 1 > g.maxSel) return;
      next = [...cur, { name: a.name, price: a.price, qty: 1 }];
    }
    setSel({ ...sel, [g.id]: next });
  };

  const valid = groups.every((g: any) => {
    const n = (sel[g.id] || []).reduce((s: number, x: any) => s + (x.qty || 1), 0);
    const minSel = g.minSel ?? 0;
    const maxSel = g.maxSel ?? 99;
    if (g.required && n < Math.max(1, minSel)) return false;
    return n <= maxSel;
  });

  const addons = Object.values(sel).flat();
  const total = qty * (price + addons.reduce((s: number, a: any) => s + (a.price || 0) * (a.qty || 1), 0));

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="relative h-44 overflow-hidden rounded-t-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {product.photoUrl
            ? <img src={product.photoUrl} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center text-5xl text-gray-600">🍽</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1e1828] via-transparent to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all">
            <X size={16} />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="text-base font-bold text-white">{product.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{product.description}</p>
          </div>
        </div>
        <div className="p-4">
          {groups.map((g: any) => (
            <div key={g.id} className="mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-bold text-white">{g.name} {g.required && <span className="text-rose-400">*obrigatório</span>} <span className="text-gray-500">({(sel[g.id] || []).reduce((s: number, x: any) => s + (x.qty || 1), 0)}/{g.maxSel})</span></p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {g.addons?.filter((a: any) => a.active).map((a: any) => {
                  const on = (sel[g.id] || []).some((x: any) => x.name === a.name);
                  return (
                    <button key={a.id} onClick={() => toggle(g, a)}
                      className="flex justify-between items-center rounded-xl px-3 py-2 text-[11px] pdv-btn-hover"
                      style={on
                        ? { background: 'rgba(225,29,72,0.2)', border: '1px solid rgba(225,29,72,0.4)', color: '#fb7185' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' }
                      }>
                      <span className="font-medium">{a.name}</span>
                      <span className="font-bold text-[10px]">{a.price ? '+' + BRL(a.price) : 'grátis'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <input className="w-full rounded-xl px-3 py-2.5 text-xs mt-3 outline-none transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }}
            placeholder="Observação neste item" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-1 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all" onClick={() => setQty(Math.max(1, qty - 1))}>
                <Minus size={14} />
              </button>
              <span className="font-bold text-sm w-7 text-center text-white">{qty}</span>
              <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all" onClick={() => setQty(qty + 1)}>
                <Plus size={14} />
              </button>
            </div>
            <button disabled={!valid || !product.available} onClick={() => {
              if (!valid) return;
              onAdd({ productId: product.id, name: product.name, unitPrice: price, qty, note, addons });
              onClose();
            }} className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 4px 20px rgba(225,29,72,0.3)' }}>
              Adicionar · {BRL(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddItemModal({ menu, onAdd, onSelectProduct, onClose }: { menu: any; onAdd: (item: any) => void; onSelectProduct: (p: any) => void; onClose: () => void }) {
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const cats = useScrollRail<HTMLDivElement>();
  const products = useMemo(() => {
    const term = norm(search);
    const list = menu.products.filter((p: any) => {
      const matchCat = cat === 'all' || p.categoryId === cat;
      // busca ignora acentos
      const matchSearch = !term
        || norm(p.name).includes(term)
        || norm(p.description).includes(term)
        || norm(p.category?.name).includes(term);
      return matchCat && matchSearch && p.available;
    });
    // aba "Todas": mais vendidos primeiro, empate em ordem alfabética
    if (cat !== 'all') return list;
    return [...list].sort((a: any, b: any) =>
      (Number(b.sold || 0) - Number(a.sold || 0)) ||
      norm(a.name).localeCompare(norm(b.name), 'pt-BR'));
  }, [menu.products, cat, search]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-bold text-white">Adicionar produto</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="px-5 pt-4">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
          </div>
          <div className="relative mb-3">
            <button onClick={() => cats.scrollPage(-1)} aria-label="Categorias anteriores"
              className="absolute left-0 top-0 bottom-1 z-10 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10"
              style={{ background: 'rgba(30,24,40,0.92)', opacity: cats.edges.left ? 1 : 0, pointerEvents: cats.edges.left ? 'auto' : 'none' }}>
              <ChevronLeft size={16} className="text-gray-400" />
            </button>
            <div ref={cats.ref} {...cats.railHandlers}
              className="flex gap-1.5 overflow-x-auto scrollbar-hide px-8 pb-1 cursor-grab active:cursor-grabbing select-none"
              style={{ touchAction: 'pan-x' }}>
              <button onClick={() => setCat('all')} className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold chip-hover whitespace-nowrap"
                style={cat === 'all' ? { background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Todas</button>
              {menu.categories.map((c: any) => (
                <button key={c.id} onClick={() => setCat(c.id)} className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold chip-hover whitespace-nowrap"
                  style={cat === c.id ? { background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>{c.name}</button>
              ))}
            </div>
            <button onClick={() => cats.scrollPage(1)} aria-label="Próximas categorias"
              className="absolute right-0 top-0 bottom-1 z-10 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10"
              style={{ background: 'rgba(30,24,40,0.92)', opacity: cats.edges.right ? 1 : 0, pointerEvents: cats.edges.right ? 'auto' : 'none' }}>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {products.map((p: any) => (
              <button key={p.id} onClick={() => {
                if (p.groups?.length) { onSelectProduct(p); } else { onAdd({ productId: p.id, name: p.name, unitPrice: p.promoPrice ?? p.price, qty: 1, addons: [], note: '' }); onClose(); }
              }}
                className="text-left rounded-xl p-3 pdv-hover" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {p.photoUrl ? <div className="w-full h-20 rounded-lg overflow-hidden mb-2"><img src={p.photoUrl} alt="" className="w-full h-full object-cover" /></div> : null}
                <p className="text-xs font-bold text-white truncate">{p.name}</p>
                <p className="text-[11px] font-black mt-0.5" style={{ color: p.promoPrice ? '#22c55e' : '#d4a574' }}>{BRL(p.promoPrice ?? p.price)}</p>
                {p.groups?.length > 0 && <p className="text-[9px] text-rose-400 mt-1 font-bold">+ adicionais</p>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BillModal({ table, orders, onClose }: { table: any; orders: any[]; onClose: () => void }) {
  const total = orders.reduce((s: number, o: any) => s + o.total, 0);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 text-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Conta</p>
          <p className="text-lg font-black text-white mt-1">{table.number}</p>
        </div>
        <div className="p-5 max-h-[400px] overflow-y-auto scrollbar-hide">
          {orders.map((o: any) => (
            <div key={o.id} className="mb-4">
              <p className="text-[10px] text-gray-500 mb-1">Pedido #{o.number}{o.customerName ? ` — ${o.customerName}` : ''}</p>
              {o.items?.map((it: any, i: number) => {
                const addons = JSON.parse(it.addonsJson || '[]');
                return (
                  <div key={i} className="mb-1.5">
                    <ItemCard qty={it.qty} name={it.name} addons={addons} note={it.note || ''} total={itemTotal(it)} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
          <span className="text-sm font-bold text-gray-400">Total</span>
          <span className="text-xl font-black text-white">{BRL(total)}</span>
        </div>
        <div className="px-5 pb-5 pt-2">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ table, tables, onTransfer, onClose }: { table: any; tables: any[]; onTransfer: (destId: string) => void; onClose: () => void }) {
  const available = tables.filter((t: any) => t.id !== table.id && t.status === 'livre');
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-1">Transferir de {table.number}</h3>
        <p className="text-[11px] text-gray-500 mb-4">Selecione a mesa de destino</p>
        <div className="grid grid-cols-3 gap-2">
          {available.map((t: any) => (
            <button key={t.id} onClick={() => { onTransfer(t.id); onClose(); }}
              className="py-3 rounded-xl text-xs font-bold pdv-btn-hover" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
              {t.number}
            </button>
          ))}
          {available.length === 0 && <p className="col-span-full text-xs text-gray-500 text-center py-4">Nenhuma mesa livre</p>}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Cancelar</button>
      </div>
    </div>
  );
}

function CloseModal({ table, orders, onClose, onConfirm }: { table: any; orders: any[]; onClose: () => void; onConfirm: (payment: string, received: number, cardFee: number) => void }) {
  const total = orders.reduce((s: number, o: any) => s + o.total, 0);
  const [payment, setPayment] = useState('pix');
  const [received, setReceived] = useState('');
  const [feeOn, setFeeOn] = useState(false);
  // taxas de crédito/débito configuradas no painel
  const [fees, setFees] = useState({ credit: 3.9, debit: 1.9 });
  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((s) => {
      if (!s || s.error) return;
      setFees({ credit: Number(s.cardFeeCredit ?? 3.9), debit: Number(s.cardFeeDebit ?? 1.9) });
    }).catch(() => {});
  }, []);
  const cardFeePct = payment === 'credito' ? fees.credit : payment === 'debito' ? fees.debit : 0;
  const cardFee = feeOn && cardFeePct > 0 ? Math.round(total * cardFeePct) / 100 : 0;
  const totalComTaxa = total + cardFee;
  const receivedNum = parseFloat(received.replace(',', '.')) || 0;
  const change = payment === 'dinheiro' && receivedNum > totalComTaxa ? receivedNum - totalComTaxa : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-3">Fechar conta — {table.number}</h3>
        <div className="space-y-2 mb-4">
          {orders.map((o: any) => (
            <div key={o.id} className="flex justify-between text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <span className="text-gray-400">#{o.number}{o.customerName ? ` — ${o.customerName}` : ''}</span>
              <span className="text-white font-bold">{BRL(o.total)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-sm font-bold text-gray-400">Total</span>
          <div className="text-right">
            {cardFee > 0 && <p className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>+ taxa {String(cardFeePct).replace('.', ',')}% {BRL(cardFee)}</p>}
            <span className="text-xl font-black text-white">{BRL(totalComTaxa)}</span>
          </div>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Forma de pagamento</p>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {PAYMENT_OPTIONS.map((p) => {
            const Icon = p.icon;
            return (
              <button key={p.id} onClick={() => { setPayment(p.id); setReceived(''); if (p.id !== 'credito' && p.id !== 'debito') setFeeOn(false); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold pdv-btn-hover"
                style={payment === p.id ? { background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}40` } : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Icon size={13} />{p.label}
              </button>
            );
          })}
        </div>
        {cardFeePct > 0 && (
          <button onClick={() => setFeeOn(!feeOn)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold mb-4 transition-all duration-200"
            style={feeOn ? { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded flex items-center justify-center" style={{ border: `1px solid ${feeOn ? '#f59e0b' : '#6b7280'}`, background: feeOn ? '#f59e0b' : 'transparent', color: '#1a1520' }}>
                {feeOn && <span className="text-[10px] font-black leading-none">✓</span>}
              </span>
              Cobrar taxa do cartão ({String(cardFeePct).replace('.', ',')}%)
            </span>
            <span className="tabular-nums">+{BRL(Math.round(total * cardFeePct) / 100)}</span>
          </button>
        )}
        {payment === 'dinheiro' && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Valor recebido</p>
            <input value={received} onChange={(e) => setReceived(e.target.value)} placeholder="0,00" inputMode="decimal"
              className="w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none transition-all duration-200 focus:border-amber-500/50"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
            {change > 0 && (
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-xs font-bold text-gray-400">Troco</span>
                <span className="text-sm font-black text-green-400">{BRL(change)}</span>
              </div>
            )}
            {receivedNum > 0 && receivedNum < totalComTaxa && (
              <p className="text-[11px] text-red-400 font-bold mt-1 px-1">Valor insuficiente</p>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Cancelar</button>
          <button disabled={payment === 'dinheiro' && (receivedNum <= 0 || receivedNum < totalComTaxa)} onClick={() => onConfirm(payment, receivedNum, cardFee)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white pdv-btn-hover disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function TableDetail({ table, orders, onOpenTable, onOpenAddItem, onOpenTransfer, onOpenBill, onOpenClose, clientName, setClientName, saved, setSaved, saveClient, removeItem }: any) {
  const total = orders.reduce((s: number, o: any) => s + o.total, 0);
  const isFree = table.status === 'livre';

  if (isFree) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
          <span className="text-xs font-bold text-white">{table.number}</span>
          <span className="text-[10px] text-gray-500">• Livre</span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={clientName} onChange={(e) => { setClientName(e.target.value); setSaved(false); }}
              placeholder="Nome do cliente (opcional)"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
          </div>
        </div>
        <button onClick={onOpenTable} className="w-full py-2.5 rounded-xl text-xs font-bold text-white pdv-btn-hover"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
          Abrir Mesa
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={clientName} onChange={(e) => { setClientName(e.target.value); setSaved(false); }}
            placeholder="Nome do cliente"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
        </div>
        {!saved && (
          <button onClick={saveClient} className="px-3 py-2 rounded-xl text-[11px] font-bold pdv-btn-hover whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' }}>
            Salvar
          </button>
        )}
      </div>

      <div className="space-y-2 mb-3 max-h-[280px] overflow-y-auto scrollbar-hide pr-1">
        {orders.map((o: any) => (
          <div key={o.id}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1" style={{ color: '#8a7a6a' }}>
              Pedido #{o.number}{o.customerName ? ` — ${o.customerName}` : ''}
            </p>
            <div className="space-y-1.5">
              {o.items?.map((it: any, i: number) => {
                const addons = JSON.parse(it.addonsJson || '[]');
                return (
                  <ItemCard key={i} qty={it.qty} name={it.name} addons={addons} note={it.note || ''} total={itemTotal(it)}>
                    <button onClick={() => removeItem(o.id, i)} className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:bg-red-500/20" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                      <Trash2 size={12} /> Remover
                    </button>
                  </ItemCard>
                );
              })}
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-xs text-gray-600 text-center py-4">Nenhum pedido</p>}
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-gray-400">Total</span>
        <span className="text-sm font-black text-white">{BRL(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onOpenAddItem} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold pdv-btn-hover"
          style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' }}>
          <Plus size={13} /> Adicionar
        </button>
        <button onClick={onOpenTransfer} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold pdv-btn-hover"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ArrowRightLeft size={13} /> Transferir
        </button>
        <button onClick={onOpenBill} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold pdv-btn-hover"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Receipt size={13} /> Conta
        </button>
        <button onClick={onOpenClose} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold pdv-btn-hover"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
          <Check size={13} /> Fechar
        </button>
      </div>
    </div>
  );
}

const SITE_URL = 'https://rincao.vercel.app';

// No app portatil o painel roda em localhost: o QR precisa apontar para o site
// publico, senao o celular do cliente nao abre.
function cardapioBase() {
  if (typeof window === 'undefined') return SITE_URL;
  const h = window.location.hostname;
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(h) ? SITE_URL : window.location.origin;
}

function tableQrUrl(t: any) {
  return `${cardapioBase()}/cardapio?mesa=${encodeURIComponent(t.id)}`;
}

function TableQrModal({ table, onClose }: { table: any; onClose: () => void }) {
  const url = tableQrUrl(table);
  const [qr, setQr] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 560, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then((d: string) => { if (alive) setQr(d); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link do QR copiado', 'success');
    } catch {
      showToast('Não foi possível copiar o link', 'error');
    }
  };

  const print = () => {
    if (!qr) return;
    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return;
    w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>QR ${table.number}</title>
<style>
  @page { size: 80mm auto; margin: 5mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
  .card { width: 70mm; margin: 0 auto; text-align: center; }
  img.logo { max-width: 42mm; max-height: 18mm; margin: 0 auto 2mm; display: block; }
  .mesa { font-size: 20px; font-weight: 900; letter-spacing: .5px; }
  .qr { width: 60mm; height: 60mm; display: block; margin: 3mm auto; }
  .txt { font-size: 11px; font-weight: 700; }
  .sub { font-size: 9px; color: #333; margin-top: 1mm; }
  .url { font-size: 7px; color: #666; word-break: break-all; margin-top: 2mm; }
  @media screen {
    body { padding: 16px; background: #eee; }
    .card { background: #fff; padding: 16px; box-shadow: 0 1px 8px rgba(0,0,0,.2); }
  }
</style></head>
<body><div class="card">
  <img class="logo" src="${window.location.origin}/logo.png" alt="">
  <div class="mesa">${table.number}</div>
  <img class="qr" src="${qr}" alt="QR ${table.number}">
  <div class="txt">Aponte a câmera e faça seu pedido</div>
  <div class="sub">Seu pedido já sai com o número desta mesa.</div>
  <div class="url">${url}</div>
</div></body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 350);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#8a7a6a' }}>QR code da mesa</p>
            <h3 className="text-lg font-black text-white">{table.number}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>
        <div className="rounded-xl p-4 flex items-center justify-center" style={{ background: '#fff' }}>
          {qr
            ? <img src={qr} alt={`QR ${table.number}`} className="w-56 h-56" />
            : <div className="w-56 h-56 flex items-center justify-center text-xs" style={{ color: '#8a7a6a' }}>Gerando QR…</div>}
        </div>
        <p className="text-[11px] mt-3 text-center" style={{ color: '#9ca3af' }}>
          O cliente escaneia, cai no cardápio e o pedido já sai como <b className="text-white">{table.number}</b>.
        </p>
        <p className="text-[9px] mt-1 text-center break-all" style={{ color: '#6b5f55' }}>{url}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={copy} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
            Copiar link
          </button>
          <button onClick={print} disabled={!qr} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-40" style={{ background: '#22c55e' }}>
            Imprimir QR
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Mesas() {
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [menu, setMenu] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [modalAddItem, setModalAddItem] = useState<string | null>(null);
  const [modalTransfer, setModalTransfer] = useState<string | null>(null);
  const [modalBill, setModalBill] = useState<string | null>(null);
  const [modalClose, setModalClose] = useState<string | null>(null);
  const [productModal, setProductModal] = useState<any>(null);
  const [qrTable, setQrTable] = useState<any>(null);
  const [modalTableId, setModalTableId] = useState<string | null>(null);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(true);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  // vista aérea / editor de layout
  const [view, setView] = useState<'map' | 'list'>('map');
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const editingRef = useRef(false);
  const dragRef = useRef<any>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { editingRef.current = editing; }, [editing]);

  const load = useCallback(async () => {
    const [t, o, m] = await Promise.all([
      fetch('/api/tables').then((r) => r.json()),
      fetch('/api/orders?limit=500').then((r) => r.json()),
      fetch('/api/menu').then((r) => r.json()),
    ]);
    const list = Array.isArray(t) ? t : [];
    // mesa sem posição salva: mostra numa grade só na tela (salva quando o
    // operador confirmar o layout)
    setTables(needsAutoLayout(list) ? autoLayoutTables(list) : list);
    setOrders(o); setMenu(m);
  }, []);

  useEffect(() => {
    load();
    // não recarrega por cima de um layout sendo editado
    const t = setInterval(() => { if (!closingRef.current && !editingRef.current) load().catch(() => {}); }, 8000);
    return () => clearInterval(t);
  }, [load]);

  const selTable = tables.find((t: any) => t.id === expanded) || null;

  const patchTable = (id: string, patch: any) => {
    setTables((prev: any[]) => prev.map((x: any) => (x.id === id ? { ...x, ...patch } : x)));
    setDirty(true);
  };

  const startDrag = (e: React.PointerEvent, t: any, mode: 'move' | 'resize') => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    setExpanded(t.id);
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      id: t.id, mode,
      startX: e.clientX, startY: e.clientY,
      ox: Number(t.posX) || 0, oy: Number(t.posY) || 0,
      ow: Number(t.width) || 120, oh: Number(t.height) || 120,
      scale: rect.width / CANVAS_W,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / d.scale;
      const dy = (e.clientY - d.startY) / d.scale;
      setTables((prev: any[]) => prev.map((x: any) => {
        if (x.id !== d.id) return x;
        if (d.mode === 'move') {
          return {
            ...x,
            posX: clampInt(d.ox + dx, 0, CANVAS_W - (Number(x.width) || 120)),
            posY: clampInt(d.oy + dy, 0, CANVAS_H - (Number(x.height) || 120)),
          };
        }
        return {
          ...x,
          width: clampInt(d.ow + dx, 56, CANVAS_W - (Number(x.posX) || 0)),
          height: clampInt(d.oh + dy, 56, CANVAS_H - (Number(x.posY) || 0)),
        };
      }));
      setDirty(true);
    };
    const up = () => { setDragging(false); dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging]);

  const saveLayout = async () => {
    const payload = tables.map((t: any) => ({
      id: t.id, number: String(t.number).trim(),
      posX: Number(t.posX) || 0, posY: Number(t.posY) || 0,
      width: Number(t.width) || 120, height: Number(t.height) || 120,
      shape: t.shape || 'square', rotation: Number(t.rotation) || 0, seats: Number(t.seats) || 0,
    }));
    const r = await fetch('/api/tables', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'layout', tables: payload }),
    }).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { showToast(r?.error || 'Não foi possível salvar o layout', 'error'); return; }
    setDirty(false);
    setEditing(false);
    await load();
    showToast('Layout do salão salvo', 'success');
  };

  const cancelLayout = () => {
    setDirty(false);
    setEditing(false);
    setExpanded(null);
    load();
  };

  const autoOrganize = () => {
    setTables((prev: any[]) => autoLayoutTables(prev));
    setDirty(true);
    showToast('Mesas organizadas em grade — ajuste e salve', 'success');
  };

  const addTable = async () => {
    const spot = firstFreeSpot(tables);
    const r = await fetch('/api/tables', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        posX: spot.x, posY: spot.y, width: 150, height: 150, shape: 'square', rotation: 0, seats: 4,
      }),
    }).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { showToast('Não foi possível criar a mesa', 'error'); return; }
    // entra na lista sem recarregar tudo (preserva o layout que ainda não foi salvo)
    setTables((prev: any[]) => [...prev, r]);
    setExpanded(r.id);
    showToast(`Mesa ${r.number} criada`, 'success');
  };

  const [confirmRemove, setConfirmRemove] = useState(false);

  const removeTable = async (id: string) => {
    const r = await fetch('/api/tables', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    }).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { showToast(r?.error || 'Não foi possível remover a mesa', 'error'); return; }
    setTables((prev: any[]) => prev.filter((t: any) => t.id !== id));
    setExpanded(null);
    setConfirmRemove(false);
    showToast('Mesa removida do salão', 'success');
  };

  useEffect(() => { setConfirmRemove(false); }, [expanded]);


  const activeTableId = modalTableId;
  const activeTable = tables.find((t: any) => t.id === activeTableId);
  const activeOrders = orders.filter((o: any) => o.tableId === activeTableId && !['concluido', 'cancelado'].includes(o.status));

  const saveClient = async () => {
    if (!activeTableId) return;
    const name = clientNames[activeTableId] || '';
    for (const o of activeOrders) {
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, customerName: name }) });
    }
    setSaved(true);
    load();
  };

  const openTable = async (tableId: string) => {
    const name = clientNames[tableId] || '';
    await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: tableId, status: 'ocupada' }) });
    if (name) {
      const tbOrders = orders.filter((o: any) => o.tableId === tableId && !['concluido', 'cancelado'].includes(o.status));
      for (const o of tbOrders) {
        await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, customerName: name }) });
      }
    }
    load();
  };

  const addItem = async (item: any) => {
    if (!activeTableId) return;
    const name = clientNames[activeTableId] || activeTable?.number || 'Cliente';
    if (activeOrders.length === 0) {
      await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        customerName: name, customerPhone: '', addressText: activeTable?.number || '', type: 'mesa', payment: 'pix',
        subtotal: item.unitPrice + (item.addons || []).reduce((s: number, a: any) => s + (a.price || 0) * (a.qty || 1), 0),
        deliveryFee: 0, discount: 0, source: 'mesa', note: '', tableId: activeTableId,
        items: [{ ...item, addons: item.addons || [] }],
      })});
    } else {
      await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'addItems', orderId: activeOrders[0].id, items: [{ ...item, addons: item.addons || [] }] }) });
    }
    load();
  };

  const removeItem = async (orderId: string, itemIdx: number) => {
    await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'removeItem', orderId, itemIndex: itemIdx }) });
    load();
  };

  const transfer = async (destId: string, srcId?: string) => {
    const fromId = srcId || activeTableId;
    if (!fromId || fromId === destId) return;
    const srcOrders = orders.filter((o: any) => o.tableId === fromId && !['concluido', 'cancelado'].includes(o.status));
    for (const o of srcOrders) {
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, tableId: destId }) });
    }
    await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: fromId, status: 'livre' }) });
    await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: destId, status: 'ocupada' }) });
    load();
  };

  const closeTable = async (payment: string, received: number, cardFee: number) => {
    if (!activeTableId || closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    try {
      let fail: string | null = null;
      let semCaixa = false;
      // taxa do cartao: fica registrada no pedido (comanda/total), mas o caixa recebe
      // so o valor da venda (sem a taxa) para bater com o extrato da maquininha
      if (cardFee > 0) {
        const alvo = [...activeOrders].reverse()[0];
        if (alvo) {
          const novaTaxa = Math.round((Number(alvo.cardFee || 0) + cardFee) * 100) / 100;
          await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: alvo.id, cardFee: novaTaxa }) }).then((x) => x.json()).catch(() => null);
        }
      }
      // o PATCH de "concluido" ja lancava/atualiza a venda no caixa (sem duplicar)
      for (const o of activeOrders) {
        const pr = await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, status: 'concluido', payment: o.source === 'pdv' ? undefined : payment }) }).then((x) => x.json()).catch(() => null);
        if (!pr || pr.error) { fail = pr?.error || 'falha na conexao'; break; }
        if (pr.cashLaunch === 'sem_caixa') semCaixa = true;
      }
      if (fail) {
        showToast(`Mesa nao fechada: ${fail}`, 'error');
        await load();
        return;
      }
      await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: activeTableId, status: 'livre' }) });
      setModalClose(null);
      await load();
      if (semCaixa) showToast('Mesa fechada, mas a venda NAO entrou no caixa — nenhum caixa aberto', 'error');
    } finally {
      closingRef.current = false;
      setClosing(false);
    }
  };

  const closeAllModals = () => {
    setModalAddItem(null);
    setModalTransfer(null);
    setModalBill(null);
    setModalClose(null);
    setProductModal(null);
    setModalTableId(null);
  };

  const openAddItem = (tableId: string) => {
    const tbOrders = orders.filter((o: any) => o.tableId === tableId && !['concluido', 'cancelado'].includes(o.status));
    if (!clientNames[tableId]) {
      setClientNames((prev) => ({ ...prev, [tableId]: tbOrders[0]?.customerName || '' }));
    }
    setSaved(true);
    setModalTableId(tableId);
    setModalAddItem(tableId);
  };

  const handleSelectProduct = (p: any) => {
    setModalAddItem(null);
    setProductModal(p);
  };

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Mesas</h1>
            <p className="text-[10px] text-gray-500">{tables.filter((t: any) => t.status === 'livre').length} livres · {tables.filter((t: any) => t.status === 'ocupada').length} ocupadas</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl p-0.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={() => setView('map')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-all"
              style={view === 'map' ? { background: '#e11d48', color: '#fff' } : { color: '#9ca3af' }}>
              <Map size={13} /> Vista aérea
            </button>
            <button onClick={() => { setView('list'); setEditing(false); setExpanded(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-all"
              style={view === 'list' ? { background: '#e11d48', color: '#fff' } : { color: '#9ca3af' }}>
              <LayoutGrid size={13} /> Lista
            </button>
          </div>

          {view === 'map' && (editing ? (
            <>
              <button onClick={addTable}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-white transition-all hover:brightness-110"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Plus size={13} /> Nova mesa
              </button>
              <button onClick={autoOrganize}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-white transition-all hover:brightness-110"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Wand2 size={13} /> Auto organizar
              </button>
              <button onClick={cancelLayout}
                className="rounded-xl px-3 py-2 text-[11px] font-bold transition-all hover:bg-white/10"
                style={{ color: '#9ca3af' }}>
                Cancelar
              </button>
              <button onClick={saveLayout}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-black text-white transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 2px 12px rgba(225,29,72,0.35)' }}>
                <Save size={13} /> Salvar layout
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-white transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Pencil size={13} /> Editar layout
            </button>
          ))}
        </div>
      </div>

      {view === 'map' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-3 items-start">
          <div>
            <div ref={mapRef}
              onPointerDown={(e) => { if (e.target === e.currentTarget) setExpanded(null); }}
              className="relative w-full rounded-2xl overflow-hidden select-none"
              style={{
                aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
                containerType: 'inline-size',
                background: 'radial-gradient(circle at 30% 20%, #241b26 0%, #17121b 60%, #120e16 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                touchAction: editing ? 'none' : 'auto',
              }}>
              {/* piso quadriculado */}
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
                  backgroundSize: `${100 / 12}% ${100 / 8}%`,
                }} />

              {tables.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <p className="text-sm font-bold text-white">Nenhuma mesa cadastrada</p>
                  <button onClick={(e) => { e.stopPropagation(); addTable(); }}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-black text-white"
                    style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
                    <Plus size={13} /> Criar primeira mesa
                  </button>
                </div>
              )}

              {tables.map((t: any) => {
                const tbOrders = orders.filter((o: any) => o.tableId === t.id && !['concluido', 'cancelado'].includes(o.status));
                const total = tbOrders.reduce((s: number, o: any) => s + o.total, 0);
                const isFree = t.status === 'livre';
                const isOccupied = t.status === 'ocupada';
                const color = isFree ? '#22c55e' : isOccupied ? '#f59e0b' : '#ef4444';
                const selected = expanded === t.id;
                const shape = t.shape || 'square';
                const radius = shape === 'round' ? '50%' : shape === 'rect' ? 14 : 16;
                const seats = Math.max(0, Math.min(20, Number(t.seats) || 0));
                const w = Number(t.width) || 120;
                const h = Number(t.height) || 120;
                const x = Number(t.posX) || 0;
                const y = Number(t.posY) || 0;
                // "Mesa 01" vira "01" no desenho (o nome completo fica no painel)
                const label = String(t.number).replace(/^mesa\s+/i, '');
                const wPct = (w / CANVAS_W) * 100;

                return (
                  <div key={t.id}
                    onPointerDown={(e) => startDrag(e, t, 'move')}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editing) { setExpanded(t.id); return; }
                      setExpanded(selected ? null : t.id);
                      setModalTableId(t.id);
                    }}
                    className={`absolute ${editing ? 'cursor-move' : 'cursor-pointer'}`}
                    style={{
                      left: `${(x / CANVAS_W) * 100}%`,
                      top: `${(y / CANVAS_H) * 100}%`,
                      width: `${(w / CANVAS_W) * 100}%`,
                      height: `${(h / CANVAS_H) * 100}%`,
                      transform: `rotate(${Number(t.rotation) || 0}deg)`,
                      zIndex: selected ? 30 : 10,
                      touchAction: editing ? 'none' : 'auto',
                    }}>
                    {/* cadeiras em volta da mesa */}
                    {seats > 0 && Array.from({ length: seats }).map((_: any, i: number) => {
                      const ang = (2 * Math.PI * i) / seats - Math.PI / 2;
                      return (
                        <span key={i} className="absolute rounded-[3px] pointer-events-none"
                          style={{
                            width: 10, height: 10,
                            left: `calc(50% + ${Math.cos(ang) * 58}%)`,
                            top: `calc(50% + ${Math.sin(ang) * 58}%)`,
                            transform: 'translate(-50%,-50%)',
                            background: 'rgba(255,255,255,0.10)',
                            border: '1px solid rgba(255,255,255,0.14)',
                          }} />
                      );
                    })}

                    {/* tampo */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-1"
                      style={{
                        borderRadius: radius,
                        background: `linear-gradient(160deg, ${color}26, ${color}10)`,
                        border: `2px solid ${selected && editing ? '#ffffff' : color}`,
                        boxShadow: selected && editing
                          ? `0 0 0 3px ${color}33, 0 10px 24px rgba(0,0,0,0.35)`
                          : '0 6px 16px rgba(0,0,0,0.28)',
                      }}>
                      <span className="font-black leading-none"
                        title={t.number}
                        style={{
                          color: '#fff',
                          fontSize: `clamp(8px, ${wPct * 0.26}cqw, 22px)`,
                          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                        {label}
                      </span>
                      {!isFree
                        ? <span className="mt-1 font-bold" style={{ color, fontSize: `clamp(7px, ${wPct * 0.11}cqw, 11px)` }}>{BRL(total)}</span>
                        : <span className="mt-0.5 font-bold uppercase tracking-wider" style={{ color: '#86efac', fontSize: `clamp(7px, ${wPct * 0.10}cqw, 10px)` }}>livre</span>}
                    </div>

                    {/* alça para redimensionar */}
                    {editing && selected && (
                      <span onPointerDown={(e) => startDrag(e, t, 'resize')}
                        className="absolute rounded-md"
                        style={{
                          width: 16, height: 16, right: -8, bottom: -8,
                          background: '#e11d48', border: '2px solid #fff',
                          cursor: 'nwse-resize', zIndex: 40, touchAction: 'none',
                        }} />
                    )}
                  </div>
                );
              })}
            </div>

            {editing && selTable ? (
              <div className="mt-2 rounded-2xl p-3 flex flex-wrap items-end gap-x-4 gap-y-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Mesa</span>
                  <input value={selTable.number}
                    onChange={(e) => patchTable(selTable.id, { number: e.target.value })}
                    className="w-24 rounded-lg px-2 py-1.5 text-sm font-bold text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>

                <div className="flex items-center gap-1">
                  {[
                    { id: 'square', label: 'Quadrada' },
                    { id: 'round', label: 'Redonda' },
                    { id: 'rect', label: 'Retangular' },
                  ].map((s) => (
                    <button key={s.id} onClick={() => patchTable(selTable.id, { shape: s.id })}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                      style={(selTable.shape || 'square') === s.id
                        ? { background: '#e11d48', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase text-gray-500">Larg.</span>
                  <input type="number" min={56} max={CANVAS_W}
                    value={Math.round(Number(selTable.width) || 120)}
                    onChange={(e) => patchTable(selTable.id, { width: clampInt(Number(e.target.value), 56, CANVAS_W - (Number(selTable.posX) || 0)) })}
                    className="w-16 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                  <span className="text-[9px] font-bold uppercase text-gray-500">Alt.</span>
                  <input type="number" min={56} max={CANVAS_H}
                    value={Math.round(Number(selTable.height) || 120)}
                    onChange={(e) => patchTable(selTable.id, { height: clampInt(Number(e.target.value), 56, CANVAS_H - (Number(selTable.posY) || 0)) })}
                    className="w-16 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase text-gray-500">Rotação</span>
                  <input type="range" min={0} max={345} step={15}
                    value={Number(selTable.rotation) || 0}
                    onChange={(e) => patchTable(selTable.id, { rotation: Number(e.target.value) })}
                    className="w-24 accent-rose-500" />
                  <span className="text-[10px] font-bold text-gray-400 w-8">{Number(selTable.rotation) || 0}°</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Armchair size={13} className="text-gray-500" />
                  <button onClick={() => patchTable(selTable.id, { seats: Math.max(0, (Number(selTable.seats) || 0) - 1) })}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:bg-white/10"
                    style={{ background: 'rgba(255,255,255,0.06)' }}><Minus size={11} /></button>
                  <span className="w-5 text-center text-xs font-bold text-white">{Number(selTable.seats) || 0}</span>
                  <button onClick={() => patchTable(selTable.id, { seats: Math.min(20, (Number(selTable.seats) || 0) + 1) })}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:bg-white/10"
                    style={{ background: 'rgba(255,255,255,0.06)' }}><Plus size={11} /></button>
                </div>

                {dirty && <span className="text-[10px] font-bold text-amber-400">alterações não salvas</span>}

                <div className="ml-auto flex items-center gap-1.5">
                  {confirmRemove ? (
                    <>
                      <span className="text-[10px] font-bold text-red-400">Remover mesa?</span>
                      <button onClick={() => removeTable(selTable.id)}
                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white"
                        style={{ background: '#dc2626' }}>Sim</button>
                      <button onClick={() => setConfirmRemove(false)}
                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-gray-300"
                        style={{ background: 'rgba(255,255,255,0.06)' }}>Não</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmRemove(true)}
                      disabled={selTable.status !== 'livre'}
                      title={selTable.status !== 'livre' ? 'Feche a conta dessa mesa antes de remover' : 'Remover mesa do salão'}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                      <Trash2 size={12} /> Remover mesa
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600 mt-2 text-center">
                {editing
                  ? 'Arraste para mover · alça no canto para redimensionar · clique numa mesa para ajustar forma, tamanho e cadeiras'
                  : 'Clique numa mesa para abrir a comanda · use "Editar layout" para desenhar o salão'}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {!editing && selTable ? (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-black text-white">{selTable.number}</p>
                  <button onClick={() => { setExpanded(null); setModalTableId(null); }}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10">
                    <X size={13} />
                  </button>
                </div>
                <TableDetail
                  table={selTable} orders={activeOrders}
                  onOpenTable={() => openTable(selTable.id)}
                  onOpenAddItem={() => openAddItem(selTable.id)}
                  onOpenTransfer={() => { setModalTableId(selTable.id); setModalTransfer(selTable.id); }}
                  onOpenBill={() => { setModalTableId(selTable.id); setModalBill(selTable.id); }}
                  onOpenClose={() => { setModalTableId(selTable.id); setModalClose(selTable.id); }}
                  clientName={clientNames[selTable.id] || ''}
                  setClientName={(name: string) => setClientNames((prev) => ({ ...prev, [selTable.id]: name }))}
                  saved={saved} setSaved={setSaved}
                  saveClient={saveClient}
                  removeItem={removeItem}
                />
              </div>
            ) : (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Salão</p>
                <div className="space-y-2">
                  {[
                    { c: '#22c55e', l: 'Livre' },
                    { c: '#f59e0b', l: 'Ocupada' },
                    { c: '#ef4444', l: 'Fechamento' },
                  ].map((s) => (
                    <div key={s.l} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.c }} />
                      <span className="text-[11px] text-gray-300">{s.l}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    {editing
                      ? 'Modo layout: arraste as mesas para desenhar o salão como numa planta baixa. Use a alça no canto para mudar o tamanho e o painel abaixo da planta para forma, rotação e cadeiras. Não esqueça de salvar.'
                      : 'Clique numa mesa para abrir a comanda. Em "Editar layout" você posiciona as mesas como numa planta baixa — o desenho fica salvo para todos os operadores.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {tables.map((t: any) => {
          const tbOrders = orders.filter((o: any) => o.tableId === t.id && !['concluido', 'cancelado'].includes(o.status));
          const total = tbOrders.reduce((s: number, o: any) => s + o.total, 0);
          const isExpanded = expanded === t.id;
          const isFree = t.status === 'livre';
          const isOccupied = t.status === 'ocupada';
          const isDragOver = dragOverId === t.id;

          return (
            <div key={t.id}
              className={`rounded-2xl overflow-hidden cursor-pointer pdv-hover ${isDragOver ? 'ring-2 ring-amber-400 scale-[1.03]' : ''}`}
              style={{
                background: isExpanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                border: isDragOver ? '2px solid #f59e0b' : isFree ? '1px solid rgba(255,255,255,0.06)' : isOccupied ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(239,68,68,0.3)',
              }}
              draggable={isOccupied && !!(modalAddItem || modalTransfer || modalBill || modalClose || productModal) === false}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', t.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(t.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => {
                e.preventDefault();
                playDropSound();
                setDragOverId(null);
                const srcId = e.dataTransfer.getData('text/plain');
                if (srcId && srcId !== t.id) {
                  const src = tables.find((x: any) => x.id === srcId);
                  if (src?.status === 'ocupada' && t.status === 'livre') {
                    transfer(t.id, src.id);
                  }
                }
              }}
              onClick={() => { if (!(modalAddItem || modalTransfer || modalBill || modalClose || productModal)) setExpanded(isExpanded ? null : t.id); }}>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFree ? 'bg-green-500' : isOccupied ? 'bg-amber-500' : 'bg-red-500'}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isFree ? 'bg-green-500' : isOccupied ? 'bg-amber-500' : 'bg-red-500'}`} />
                    </span>
                    <span className="text-sm font-bold text-white">{t.number}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setQrTable(t); }} title="QR code da mesa"
                      className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-white/10" style={{ color: '#8a7a6a' }}>
                      <QrCode size={13} />
                    </button>
                    {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                </div>

                {!isExpanded && (
                  <>
                    <p className="text-[11px] text-gray-500 mb-1">
                      {isFree ? 'Livre' : `${tbOrders.length} pedido(s)`}
                    </p>
                    {!isFree && <p className="text-xs font-black text-white">{BRL(total)}</p>}
                  </>
                )}
              </div>

              {isExpanded && (
                <div className="px-4 pb-4" onClick={(e) => e.stopPropagation()}>
                  <TableDetail
                    table={t} orders={tbOrders}
                    onOpenTable={() => openTable(t.id)}
                    onOpenAddItem={() => openAddItem(t.id)}
                    onOpenTransfer={() => { setModalTableId(t.id); setModalTransfer(t.id); }}
                    onOpenBill={() => { setModalTableId(t.id); setModalBill(t.id); }}
                    onOpenClose={() => { setModalTableId(t.id); setModalClose(t.id); }}
                    clientName={clientNames[t.id] || ''}
                    setClientName={(name: string) => setClientNames((prev) => ({ ...prev, [t.id]: name }))}
                    saved={saved} setSaved={setSaved}
                    saveClient={saveClient}
                    removeItem={removeItem}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {view === 'list' && (
        <p className="text-[10px] text-gray-600 mt-4 text-center">Toque na mesa para expandir · Arraste uma mesa ocupada sobre uma livre para transferir</p>
      )}

      {modalAddItem && menu && !productModal && <AddItemModal menu={menu} onAdd={addItem} onSelectProduct={handleSelectProduct} onClose={closeAllModals} />}
      {productModal && <ProductModal product={productModal} onAdd={addItem} onClose={() => { setProductModal(null); setModalTableId(null); }} />}
      {modalTransfer && activeTable && <TransferModal table={activeTable} tables={tables} onTransfer={(destId) => transfer(destId)} onClose={closeAllModals} />}
      {modalBill && activeTable && <BillModal table={activeTable} orders={activeOrders} onClose={closeAllModals} />}
      {modalClose && activeTable && <CloseModal table={activeTable} orders={activeOrders} onClose={closeAllModals} onConfirm={closeTable} />}
      {qrTable && <TableQrModal table={qrTable} onClose={() => setQrTable(null)} />}
    </div>
  );
}
