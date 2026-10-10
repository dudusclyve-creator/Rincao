'use client';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { BRL, receiptText, showToast, printReceiptText, maskCpf } from '@/lib/utils';
import { ItemCard } from '@/components/ItemCard';
import { ShoppingBag, Plus, Minus, CreditCard, Banknote, Smartphone, X, Search, Package, MapPin, ChevronLeft, ChevronRight, StickyNote, Table2 } from 'lucide-react';

const DELIVERY_ZONES_FALLBACK: Record<string, { name: string; fee: number }[]> = {
  'Santana do Livramento': [
    { name: 'Centro', fee: 5 }, { name: 'Boa Vista', fee: 5 }, { name: 'Sao Jose', fee: 6 },
    { name: 'Cidade Alta', fee: 6 }, { name: 'Liberdade', fee: 7 }, { name: 'Jardim do Sol', fee: 7 },
    { name: 'Parque Industrial', fee: 8 }, { name: 'Vila Nova', fee: 8 }, { name: 'Bela Vista', fee: 9 },
    { name: 'Floresta', fee: 9 }, { name: 'Santo Antonio', fee: 10 },
  ],
  'Rivera': [
    { name: 'Centro', fee: 8 }, { name: 'Paz', fee: 8 }, { name: 'Santa Cruz', fee: 9 },
    { name: 'Monaco', fee: 10 }, { name: 'Maria Clara', fee: 10 }, { name: 'Floresta', fee: 12 },
    { name: 'Interlagos', fee: 12 }, { name: 'Sao Jorge', fee: 14 },
  ],
};

const TYPE_OPTIONS = [
  { id: 'balcao', label: 'Balcão' },
  { id: 'mesa', label: 'Mesa' },
  { id: 'retirada', label: 'Retirada' },
  { id: 'entrega', label: 'Entrega' },
];

const PAYMENT_OPTIONS = [
  { id: 'pix', label: 'PIX', icon: Smartphone, color: '#22c55e' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: '#f59e0b' },
  { id: 'debito', label: 'Débito', icon: CreditCard, color: '#3b82f6' },
  { id: 'credito', label: 'Crédito', icon: CreditCard, color: '#8b5cf6' },
];

function ProductModal({ product, allProducts, onClose, onAdd }: { product: any; allProducts: any[]; onClose: () => void; onAdd: (item: any) => void }) {
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
    if (g.required && n < Math.max(1, g.minSel)) return false;
    return n >= g.minSel;
  });

  const addons = Object.values(sel).flat();
  const total = qty * (price + addons.reduce((s: number, a: any) => s + (a.price || 0) * (a.qty || 1), 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative h-44 overflow-hidden rounded-t-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {product.photoUrl
            ? <img src={product.photoUrl} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center text-5xl text-gray-600">🍽</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1e1828] via-transparent to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 hover:rotate-90 transition-all duration-300">
            <X size={16} />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="text-base font-bold text-white">{product.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{product.description}</p>
          </div>
        </div>

        <div className="p-4">
          {/* Addon Groups */}
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

          {/* Note */}
          <input className="w-full rounded-xl px-3 py-2.5 text-xs mt-3 outline-none transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }}
            placeholder="Observação neste item" value={note} onChange={(e) => setNote(e.target.value)} />

          {/* Qty + Add */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-1 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200" onClick={() => setQty(Math.max(1, qty - 1))}>
                <Minus size={14} />
              </button>
              <span className="font-bold text-sm w-7 text-center text-white">{qty}</span>
              <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200" onClick={() => setQty(qty + 1)}>
                <Plus size={14} />
              </button>
            </div>
            <button disabled={!valid || !product.available} onClick={() => {
              if (!valid) return;
              onAdd({ productId: product.id, name: product.name, unitPrice: price, qty, note, addons });
              onClose();
            }} className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 4px 20px rgba(225,29,72,0.3)' }}>
              Adicionar · {BRL(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartItemNoteModal({ item, onSave, onClose }: { item: any; onSave: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState(item.note || '');
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-1">Observação — {item.name}</h3>
        <p className="text-[11px] text-gray-500 mb-3">Ex: sem cebola, trocar molho...</p>
        <input autoFocus className="w-full rounded-xl px-3 py-2.5 text-xs outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sua observação..." />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Cancelar</button>
          <button onClick={() => { onSave(note); onClose(); }} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

const PDV_STORAGE_KEY = 'pdv_state';

function loadPdvState() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(PDV_STORAGE_KEY) || 'null'); } catch { return null; }
}

export default function PDV() {
  const saved = loadPdvState();
  const [menu, setMenu] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [cat, setCat] = useState('all');
  const [cart, setCart] = useState<any[]>(saved?.cart || []);
  const [type, setType] = useState(saved?.type || 'balcao');
  const [payment, setPayment] = useState(saved?.payment || 'pix');
  const [client, setClient] = useState(saved?.client || '');
  const [clientPhone, setClientPhone] = useState(saved?.clientPhone || '');
  const [clientCpf, setClientCpf] = useState(saved?.clientCpf || '');
  const [orderNote, setOrderNote] = useState(saved?.orderNote || '');
  const [search, setSearch] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [modalProduct, setModalProduct] = useState<any>(null);
  const [editNoteIdx, setEditNoteIdx] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState(saved?.selectedTable || '');
  const [changeFor, setChangeFor] = useState(0);
  const [splitPayment, setSplitPayment] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([{ method: 'pix', amount: 0 }]);
  const [deliveryCity, setDeliveryCity] = useState(saved?.deliveryCity || '');
  const [deliveryBairro, setDeliveryBairro] = useState(saved?.deliveryBairro || '');
  const [deliveryStreet, setDeliveryStreet] = useState(saved?.deliveryStreet || '');
  const [deliveryNum, setDeliveryNum] = useState(saved?.deliveryNum || '');
  const [deliveryComp, setDeliveryComp] = useState(saved?.deliveryComp || '');
  const [feeOverride, setFeeOverride] = useState<number | null>(saved?.feeOverride ?? null);
  const [showAddress, setShowAddress] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState<Record<string, { name: string; fee: number }[]>>(DELIVERY_ZONES_FALLBACK);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const catsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const state = { cart, type, payment, client, clientPhone, clientCpf, orderNote, selectedTable, deliveryCity, deliveryBairro, deliveryStreet, deliveryNum, deliveryComp, feeOverride };
    localStorage.setItem(PDV_STORAGE_KEY, JSON.stringify(state));
  }, [cart, type, payment, client, clientPhone, clientCpf, orderNote, selectedTable, deliveryCity, deliveryBairro, deliveryStreet, deliveryNum, deliveryComp, feeOverride]);

  useEffect(() => {
    fetch('/api/menu').then((r) => r.json()).then(setMenu);
    fetch('/api/tables').then((r) => r.json()).then(setTables);
    fetch('/api/customers').then((r) => r.json()).then((d) => setCustomers(Array.isArray(d) ? d : d.customers || [])).catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    const loadAreas = () => {
      fetch('/api/delivery-areas', { cache: 'no-store' }).then((r) => r.json()).then((areas: any[]) => {
        const zones: Record<string, { name: string; fee: number }[]> = {};
        for (const a of areas) {
          if (a.active === false) continue;
          const city = a.city || 'Santana do Livramento';
          if (!zones[city]) zones[city] = [];
          zones[city].push({ name: a.name, fee: a.fee });
        }
        if (Object.keys(zones).length > 0) setDeliveryZones(zones);
      }).catch(() => {});
    };
    loadAreas();
    const t = setInterval(loadAreas, 15000);
    return () => clearInterval(t);
  }, []);

  if (!menu) {
    return (
      <div className="min-h-[calc(100vh-48px)] rounded-2xl p-5 flex items-center justify-center" style={{ background: '#1a1520' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#e11d48' }} />
          <p className="text-xs text-gray-500">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  const products = menu.products.filter((p: any) => {
    const matchCat = cat === 'all' || p.categoryId === cat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const sub = cart.reduce((s: number, i: any) => s + i.qty * (i.unitPrice + (i.addons || []).reduce((a: number, ad: any) => a + ad.price * (ad.qty || 1), 0)), 0);
  const zoneFee = type === 'entrega' && deliveryCity && deliveryBairro
    ? (deliveryZones[deliveryCity]?.find(z => z.name === deliveryBairro)?.fee || 0)
    : 0;
  const deliveryFee = type === 'entrega' ? (feeOverride ?? zoneFee) : 0;
  const total = Math.max(0, sub + deliveryFee);
  const itemCount = cart.reduce((s: number, i: any) => s + i.qty, 0);
  const troco = (() => {
    if (changeFor <= 0) return 0;
    if (splitPayment) {
      const cashAmount = payments.find(p => p.method === 'dinheiro')?.amount || 0;
      return Math.max(0, changeFor - cashAmount);
    }
    return payment === 'dinheiro' ? Math.max(0, changeFor - total) : 0;
  })();

  const addToCartFromModal = (item: any) => {
    setLastAdded(item.productId);
    setTimeout(() => setLastAdded(null), 400);
    setCart(prev => [...prev, { id: Math.random().toString(36), ...item }]);
  };

  const quickAdd = (p: any) => {
    setLastAdded(p.id);
    setTimeout(() => setLastAdded(null), 400);
    if (p.groups?.length) { setModalProduct(p); return; }
    setCart(prev => [...prev, { id: Math.random().toString(36), productId: p.id, name: p.name, unitPrice: p.promoPrice ?? p.price, qty: 1, note: '', addons: [] }]);
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(x => x.id !== id));

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, qty: newQty } : i);
    });
  };

  const updateNote = (id: string, note: string) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, note } : i));
  };

  const finish = async () => {
    if (finishing || !cart.length) return;
    if (splitPayment) {
      const sumCents = Math.round(payments.reduce((s, p) => s + Number(p.amount || 0), 0) * 100);
      const totalCents = Math.round(total * 100);
      if (sumCents !== totalCents) {
        showToast(`Pagamentos (${BRL(sumCents / 100)}) nao fecham com o total (${BRL(totalCents / 100)})`, 'error');
        return;
      }
    }
    setFinishing(true);
    try {
    const tableObj = tables.find((t: any) => t.id === selectedTable);
    const addressText = type === 'entrega'
      ? `${deliveryStreet}${deliveryNum ? ', ' + deliveryNum : ''}${deliveryComp ? ' - ' + deliveryComp : ''} - ${deliveryBairro}, ${deliveryCity}`
      : type === 'mesa' ? (tableObj?.number ? String(tableObj.number) : `Mesa ${selectedTable}`) : type.toUpperCase();

    const activePayments = payments.filter((p) => Number(p.amount || 0) > 0);
    const paymentMethod = splitPayment ? activePayments.map(p => `${p.method}:${p.amount}`).join(',') : payment;
    const splitNote = splitPayment ? `Pagamento dividido: ${activePayments.map(p => `${PAYMENT_OPTIONS.find(o => o.id === p.method)?.label || p.method} ${BRL(p.amount)}`).join(' + ')}` : '';

    const o = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: client || (type === 'mesa' ? (tableObj?.number || 'Mesa') : 'PDV'), customerPhone: clientPhone || '',
        customerCpf: clientCpf || '',
        street: deliveryStreet, number: deliveryNum, complement: deliveryComp,
        district: deliveryBairro, addressText,
        type, payment: paymentMethod, changeFor: (payment === 'dinheiro' || (splitPayment && payments.some(p => p.method === 'dinheiro'))) && changeFor > 0 ? changeFor : undefined,
        subtotal: sub, deliveryFee, discount: 0, source: 'pdv', note: [orderNote, splitNote].filter(Boolean).join(' | '),
        tableId: type === 'mesa' ? selectedTable : undefined,
        items: cart.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, unitPrice: i.unitPrice, addons: i.addons || [], note: i.note || '' })),
      })
    }).then((r) => r.json());
    if (!o?.id) {
      showToast('Erro ao criar pedido — tente novamente', 'error');
      return;
    }
    // limpa o carrinho na hora: se algo falhar depois, nao da pra finalizar de novo
    setCart([]); setOrderNote(''); setClient(''); setClientPhone(''); setClientCpf(''); setChangeFor(0); setSelectedTable(''); setSplitPayment(false); setPayments([{ method: 'pix', amount: 0 }]);
    setDeliveryCity(''); setDeliveryBairro(''); setDeliveryStreet(''); setDeliveryNum(''); setDeliveryComp(''); setFeeOverride(null);
    localStorage.removeItem(PDV_STORAGE_KEY);
    let cashError: string | null = null;
    try {
      if (splitPayment) {
        for (const p of activePayments) {
          const cr = await fetch('/api/cash', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'movement', kind: 'venda', method: p.method, amount: Number(p.amount), orderId: o.id, reason: `PDV #${o.number}` })
          }).then((x) => x.json()).catch(() => null);
          if (cr?.error && !cashError) cashError = cr.error;
        }
      } else {
        const cr = await fetch('/api/cash', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'movement', kind: 'venda', method: payment, amount: o.total, orderId: o.id, reason: `PDV #${o.number}` })
        }).then((x) => x.json()).catch(() => null);
        if (cr?.error) cashError = cr.error;
      }
    } catch {}
    if (type === 'mesa' && selectedTable) {
      try { await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: selectedTable, status: 'ocupada' }) }); } catch {}
    }
    if (cashError) {
      showToast(`Pedido #${o.number} criado, mas NAO lancado no caixa (${cashError}) — abra o caixa e registre manualmente`, 'error');
    } else {
      showToast(`Venda #${o.number} finalizada: ${BRL(o.total)}`, 'success');
    }
    const receiptBase = {
      store: 'Rincão Lanches', number: o.number, date: new Date(o.createdAt).toLocaleString('pt-BR'),
      customerName: client || 'PDV', customerPhone: clientPhone || '',
      items: cart.map((it: any) => ({ qty: it.qty, name: it.name, unitPrice: it.unitPrice, addons: it.addons || [], note: it.note || '' })),
      payment: paymentMethod, subtotal: sub, fee: deliveryFee, discount: 0, total: o.total,
      addressText, type, changeFor: ((payment === 'dinheiro' || (splitPayment && payments.some(p => p.method === 'dinheiro'))) && changeFor > 0) ? changeFor : undefined,
      note: [orderNote, splitNote].filter(Boolean).join(' | '),
      width: '80mm' as const,
    };
    const pages = [receiptText(receiptBase)];
    // 1a impressao de entrega: sai junto a comanda do entregador
    if (type === 'entrega') pages.push(receiptText({ ...receiptBase, variant: 'entregador' }));
    fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, printed: true }) }).catch(() => {});
    for (const p of pages) {
      fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: p, printer: 'Padrao' }) }).catch(() => {});
    }
    printReceiptText(pages);
    } finally {
      setFinishing(false);
    }
  };

  const scrollCats = (dir: number) => {
    catsRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  const availableTables = tables.filter((t: any) => t.status === 'livre');
  const cities = Object.keys(deliveryZones);
  const bairros = deliveryCity ? deliveryZones[deliveryCity] || [] : [];

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <ShoppingBag size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">PDV</h1>
            <p className="text-xs text-gray-500">Balcão / Mesa / Retirada / Entrega</p>
          </div>
        </div>
        {cart.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(225,29,72,0.15)' }}>
            <ShoppingBag size={16} className="text-rose-400" />
            <span className="text-sm font-bold text-rose-400">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: Products */}
        <div className="flex-1 min-w-0">
          {/* Search */}
          <div className="relative mb-4">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..."
              className="w-full pl-12 pr-4 py-4 rounded-xl text-lg outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50 focus:shadow-[0_0_0_2px_rgba(225,29,72,0.15)]"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
          </div>

          {/* Categories - scrollable with arrows */}
          <div className="relative mb-5">
            <button onClick={() => scrollCats(-1)} className="absolute left-0 top-0 bottom-0 z-10 w-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all duration-200" style={{ background: 'rgba(26,21,32,0.9)' }}>
              <ChevronLeft size={20} className="text-gray-400" />
            </button>
            <div ref={catsRef} className="flex gap-2 overflow-x-auto scrollbar-hide px-10 pb-1">
              <button onClick={() => setCat('all')}
                className="flex-shrink-0 px-6 py-3 rounded-full text-base font-bold pdv-btn-hover whitespace-nowrap"
                style={cat === 'all'
                  ? { background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff', boxShadow: '0 2px 12px rgba(225,29,72,0.3)' }
                  : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
                Todas
              </button>
              {menu.categories.map((c: any) => {
                const count = menu.products.filter((p: any) => p.categoryId === c.id).length;
                return (
                  <button key={c.id} onClick={() => setCat(c.id)}
                    className="flex-shrink-0 px-6 py-3 rounded-full text-base font-bold pdv-btn-hover whitespace-nowrap"
                    style={cat === c.id
                      ? { background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff', boxShadow: '0 2px 12px rgba(225,29,72,0.3)' }
                      : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {c.name} <span className="ml-1 opacity-50">{count}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => scrollCats(1)} className="absolute right-0 top-0 bottom-0 z-10 w-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all duration-200" style={{ background: 'rgba(26,21,32,0.9)' }}>
              <ChevronRight size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {products.map((p: any) => {
              const inCart = cart.find(c => c.productId === p.id);
              const justAdded = lastAdded === p.id;
              return (
                <button key={p.id} disabled={!p.available} onClick={() => quickAdd(p)}
                  className="relative text-left rounded-2xl overflow-hidden pdv-hover disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: justAdded ? 'rgba(225,29,72,0.12)' : inCart ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                    border: justAdded ? '1px solid rgba(225,29,72,0.4)' : inCart ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
                    animation: justAdded ? 'cardPulse 0.4s ease' : undefined,
                  }}>
                  {/* Image */}
                  <div className="w-full h-20 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl text-gray-700">🍽</div>}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    {inCart && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: '#e11d48' }}>
                        {inCart.qty}
                      </div>
                    )}
                    <p className="text-sm font-bold text-white leading-tight truncate">{p.name}</p>
                    <p className="text-sm font-black mt-1" style={{ color: p.promoPrice ? '#22c55e' : '#d4a574' }}>
                      {BRL(p.promoPrice ?? p.price)}
                    </p>
                    {p.promoPrice && <p className="text-[10px] line-through text-gray-600">{BRL(p.price)}</p>}
                    {p.groups?.length > 0 && (
                      <p className="text-[10px] text-rose-400 mt-1 font-bold">+ adicionais</p>
                    )}
                  </div>
                </button>
              );
            })}
            {products.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
                <Package size={28} className="mb-2 opacity-30" />
                <p className="text-xs">Nenhum produto encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0">
          <div className="rounded-2xl lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:flex lg:flex-col" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Cart Header */}
            <div className="shrink-0 px-5 py-4 flex items-center justify-between rounded-t-2xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={20} className="text-rose-400" />
                <span className="text-lg font-bold text-white">Venda</span>
              </div>
              {cart.length > 0 && (
                <button onClick={() => { setCart([]); setOrderNote(''); setClient(''); setClientPhone(''); setClientCpf(''); setChangeFor(0); setSelectedTable(''); setDeliveryCity(''); setDeliveryBairro(''); setDeliveryStreet(''); setDeliveryNum(''); setDeliveryComp(''); setFeeOverride(null); localStorage.removeItem(PDV_STORAGE_KEY); }} className="text-xs text-gray-500 hover:text-red-400 hover:scale-105 transition-all duration-200">Limpar</button>
              )}
            </div>

            {/* Scrollable body */}
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto scrollbar-hide">
            {/* Cart Items */}
            <div>
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                  <ShoppingBag size={28} className="mb-2 opacity-30" />
                  <p className="text-sm">Carrinho vazio</p>
                  <p className="text-xs text-gray-600 mt-0.5">Toque num produto</p>
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {cart.map((item, idx) => (
                    <ItemCard key={item.id} qty={item.qty} name={item.name} unitPrice={item.unitPrice} addons={item.addons || []} note={item.note || ''}>
                      <div className="flex items-center gap-1 rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.06)', padding: 2 }}>
                        <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all duration-200">
                          <Minus size={14} className="text-gray-400" />
                        </button>
                        <span className="text-sm font-bold text-white w-7 text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all duration-200">
                          <Plus size={14} className="text-gray-400" />
                        </button>
                      </div>
                      <span className="text-xs text-gray-500">{BRL(item.unitPrice)} un.</span>
                      <button onClick={() => setEditNoteIdx(idx)} className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-rose-400 transition-all duration-200">
                        <StickyNote size={12} />
                        {item.note ? <span>editar obs</span> : <span>obs</span>}
                      </button>
                      <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-all duration-200">
                        <X size={13} className="text-gray-500" />
                      </button>
                    </ItemCard>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <>
                <div className="mx-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                {/* Type */}
                <div className="px-4 pt-4">
                  <p className="text-sm uppercase tracking-wider text-gray-500 font-bold mb-2">Tipo</p>
                  <div className="grid grid-cols-4 gap-2">
                    {TYPE_OPTIONS.map((t) => (
                      <button key={t.id} onClick={() => { setType(t.id); setShowAddress(t.id === 'entrega'); }}
                        className="flex flex-col items-center gap-1 py-4 rounded-xl text-sm font-bold pdv-btn-hover"
                        style={type === t.id
                          ? { background: 'rgba(225,29,72,0.15)', color: '#fb7185', border: '1px solid rgba(225,29,72,0.3)' }
                          : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table Selection */}
                {type === 'mesa' && (
                  <div className="px-4 pt-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2 flex items-center gap-1"><Table2 size={13} /> Selecionar Mesa</p>
                    <div className="grid grid-cols-4 gap-2">
                      {availableTables.map((t: any) => (
                        <button key={t.id} onClick={() => setSelectedTable(t.id)}
                          className="py-2.5 rounded-xl text-xs font-bold pdv-btn-hover"
                          style={selectedTable === t.id
                            ? { background: 'rgba(225,29,72,0.15)', color: '#fb7185', border: '1px solid rgba(225,29,72,0.3)' }
                            : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {t.number}
                        </button>
                      ))}
                      {availableTables.length === 0 && <p className="col-span-full text-[10px] text-gray-500 text-center py-2">Nenhuma mesa livre</p>}
                    </div>
                  </div>
                )}

                {/* Delivery Address */}
                {type === 'entrega' && (
                  <div className="px-4 pt-4">
                    <button onClick={() => setShowAddress(!showAddress)} className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 font-bold mb-2 hover:text-rose-400 transition-colors">
                      <MapPin size={13} /> Endereço de entrega {deliveryBairro && <span className="text-green-400 normal-case tracking-normal">· {deliveryBairro} ({BRL(deliveryFee)})</span>}
                    </button>
                    {showAddress && (
                      <div className="space-y-2 pb-2">
                        <select value={deliveryCity} onChange={(e) => { setDeliveryCity(e.target.value); setDeliveryBairro(''); setFeeOverride(null); }}
                          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 hover:border-white/20" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }}>
                          <option value="">Cidade</option>
                          {cities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {deliveryCity && (
                          <select value={deliveryBairro} onChange={(e) => { setDeliveryBairro(e.target.value); setFeeOverride(null); }}
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 hover:border-white/20" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }}>
                            <option value="">Bairro</option>
                            {bairros.map(b => <option key={b.name} value={b.name}>{b.name} — {BRL(b.fee)}</option>)}
                          </select>
                        )}
                        <div className="flex gap-2">
                          <input value={deliveryStreet} onChange={(e) => setDeliveryStreet(e.target.value)} placeholder="Rua" className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                          <input value={deliveryNum} onChange={(e) => setDeliveryNum(e.target.value)} placeholder="Nº" className="w-20 px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                        </div>
                        <div className="flex gap-2">
                          <input value={deliveryComp} onChange={(e) => setDeliveryComp(e.target.value)} placeholder="Complemento" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment */}
                <div className="px-4 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm uppercase tracking-wider text-gray-500 font-bold">Pagamento</p>
                        <button onClick={() => { setSplitPayment(!splitPayment); if (!splitPayment) setPayments([{ method: payment, amount: total }]); }}
                      className="text-xs font-bold pdv-btn-hover px-3 py-1.5 rounded-lg" style={{ color: splitPayment ? '#fb7185' : '#6b7280' }}>
                      {splitPayment ? '✕ Dividir' : '÷ Dividir conta'}
                    </button>
                  </div>
                  {!splitPayment ? (
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_OPTIONS.map((p) => {
                        const Icon = p.icon;
                        return (
                          <button key={p.id} onClick={() => setPayment(p.id)}
                            className="flex items-center gap-2 px-4 py-4 rounded-xl text-base font-bold pdv-btn-hover"
                            style={payment === p.id
                              ? { background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}40` }
                              : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Icon size={17} />{p.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((pmt, idx) => {
                        const opt = PAYMENT_OPTIONS.find(o => o.id === pmt.method);
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <select value={pmt.method} onChange={(e) => {
                              const np = [...payments]; np[idx] = { ...np[idx], method: e.target.value }; setPayments(np);
                            }} className="w-32 px-2 py-2.5 rounded-xl text-xs font-bold outline-none transition-all duration-200 hover:border-white/20" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }}>
                              {PAYMENT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                            </select>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">R$</span>
                              <input type="number" value={pmt.amount || ''} onChange={(e) => {
                                const np = [...payments]; np[idx] = { ...np[idx], amount: Number(e.target.value) }; setPayments(np);
                              }} placeholder="0,00" className="w-full pl-7 pr-2 py-2.5 rounded-xl text-xs font-bold outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                            </div>
                            {payments.length > 1 && (
                              <button onClick={() => setPayments(payments.filter((_, i) => i !== idx))} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-all duration-200">
                                <X size={14} className="text-gray-500" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between">
                        <button onClick={() => {
                          const remaining = total - payments.reduce((s, p) => s + p.amount, 0);
                          const methods = ['pix', 'dinheiro', 'debito', 'credito'];
                          const nextMethod = methods[payments.length % methods.length];
                          setPayments([...payments, { method: nextMethod, amount: Math.max(0, Math.round(remaining * 100) / 100) }]);
                        }} className="text-xs font-bold text-rose-400 hover:text-rose-300 hover:scale-105 transition-all duration-200">+ Adicionar forma</button>
                        {payments.length > 0 && (
                          <p className="text-xs font-bold" style={{ color: payments.reduce((s, p) => s + p.amount, 0) >= total ? '#22c55e' : '#fb7185' }}>
                            {BRL(payments.reduce((s, p) => s + p.amount, 0))} / {BRL(total)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Troco */}
                {((payment === 'dinheiro' && !splitPayment) || (splitPayment && payments.some(p => p.method === 'dinheiro'))) && (
                  <div className="px-4 pt-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Troco</p>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">R$</span>
                        <input type="number" value={changeFor || ''} onChange={(e) => setChangeFor(Number(e.target.value))} placeholder="Valor recebido"
                          className="w-full pl-9 pr-3 py-3 rounded-xl text-sm outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                      </div>
                      {changeFor > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Troco</p>
                          <p className="text-base font-black text-green-400">{BRL(troco)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Client + Note */}
                <div className="px-4 pt-4 space-y-2">
                  <div className="relative">
                    <input value={client} onChange={(e) => { setClient(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Cliente (opcional)"
                      className="w-full px-3 py-3.5 rounded-xl text-base outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                    {showSuggestions && (() => {
                      const q = client.trim().toLowerCase();
                      const filtered = customers.filter((c: any) => !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 15);
                      if (filtered.length === 0) return null;
                      return (
                        <div className="absolute left-0 right-0 bottom-full mb-1 z-50 rounded-xl overflow-hidden shadow-2xl overflow-y-auto" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.12)', maxHeight: '280px' }}>
                          {q === '' && <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-bold text-gray-500">Clientes salvos ({filtered.length})</div>}
                          {filtered.map((c: any) => (
                            <button key={c.id} onMouseDown={() => {
                              setClient(c.name);
                              setClientPhone(c.phone || '');
                              setClientCpf(c.cpf || '');
                              const junkAddr = /^\s*(retirada|consumo|balcao|pdv)/i;
                              if (c.street && !junkAddr.test(c.street)) setDeliveryStreet(c.street);
                              if (c.number && !junkAddr.test(c.number)) setDeliveryNum(c.number);
                              if (c.complement && !junkAddr.test(c.complement)) setDeliveryComp(c.complement);
                              if (c.district) {
                                const raw = String(c.district);
                                const hasComma = raw.includes(',');
                                const rawBairro = (hasComma ? raw.slice(0, raw.lastIndexOf(',')) : raw).trim();
                                const rawCity = (hasComma ? raw.slice(raw.lastIndexOf(',') + 1) : '').trim();
                                let city: string | undefined;
                                if (rawCity && (deliveryZones[rawCity] || []).some(z => z.name === rawBairro)) city = rawCity;
                                else if (deliveryCity && (deliveryZones[deliveryCity] || []).some(z => z.name === rawBairro)) city = deliveryCity;
                                else city = Object.keys(deliveryZones).find(ci => (deliveryZones[ci] || []).some(z => z.name === rawBairro));
                                if (city && rawBairro) {
                                  if (city !== deliveryCity) setDeliveryCity(city);
                                  setDeliveryBairro(rawBairro);
                                  setFeeOverride(null);
                                }
                              }
                              if (type === 'entrega') setShowAddress(true);
                              setShowSuggestions(false);
                            }} className="w-full px-3 py-3.5 text-left text-base hover:bg-white/10 transition-all duration-150 flex items-center justify-between gap-3" style={{ color: '#f0e8e0' }}>
                              <span className="min-w-0">
                                <span className="font-bold block truncate">{c.name}</span>
                                {(() => { const parts = [c.street, c.number && `nº ${c.number}`, c.district].filter((v: any) => v && !/^\s*(retirada|consumo|balcao|pdv)/i.test(String(v))); return parts.length ? <span className="text-[11px] text-gray-600 block truncate">{parts.join(', ')}</span> : null; })()}
                              </span>
                              <span className="text-sm text-gray-500 shrink-0">{c.phone}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <input value={clientCpf} onChange={(e) => setClientCpf(maskCpf(e.target.value))} placeholder="CPF (opcional — para emitir a nota)"
                    className="w-full px-3 py-3.5 rounded-xl text-base outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                  <input value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Observação do pedido"
                    className="w-full px-3 py-3.5 rounded-xl text-base outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                </div>
              </>
            )}
            </div>

            {/* Totals + Finish */}
            {cart.length > 0 && (
              <div className="shrink-0 p-4 rounded-b-2xl" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-base text-gray-400"><span>Subtotal</span><span>{BRL(sub)}</span></div>
                  {type === 'entrega' && (
                    <div className="flex items-center justify-between text-base text-gray-400">
                      <span>Taxa entrega {feeOverride !== null && feeOverride !== zoneFee && <span className="text-[11px] font-bold" style={{ color: '#f59e0b' }}>editada</span>}</span>
                      <div className="flex items-center gap-1.5">
                        <input type="number" min={0} step="0.50" value={deliveryFee} title="Motoboy cobra outro valor? Edite a taxa aqui"
                          onChange={(e) => setFeeOverride(Math.max(0, Number(e.target.value) || 0))}
                          onBlur={() => { if (feeOverride !== null && feeOverride === zoneFee) setFeeOverride(null); }}
                          className="w-24 px-2.5 py-1.5 rounded-lg text-right text-base font-bold outline-none focus:border-amber-400/50 transition-colors" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
                        {feeOverride !== null && feeOverride !== zoneFee && (
                          <button onClick={() => setFeeOverride(null)} title={`Voltar à taxa da zona (${BRL(zoneFee)})`} className="text-sm text-gray-500 hover:text-white transition-colors">↺</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-white">Total</span>
                  <span className="text-2xl font-black text-white">{BRL(total)}</span>
                </div>
                <button onClick={finish}
                  disabled={!cart.length || finishing || (type === 'mesa' && !selectedTable) || (type === 'entrega' && (!deliveryCity || !deliveryBairro))}
                  className="w-full py-5 rounded-xl text-lg font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed pdv-btn-hover"
                  style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 4px 20px rgba(225,29,72,0.3)' }}>
                  {finishing ? 'Finalizando...' : 'Finalizar + Imprimir'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modalProduct && (
        <ProductModal product={modalProduct} allProducts={menu.products} onClose={() => setModalProduct(null)} onAdd={addToCartFromModal} />
      )}
      {editNoteIdx !== null && cart[editNoteIdx] && (
        <CartItemNoteModal item={cart[editNoteIdx]} onSave={(note) => updateNote(cart[editNoteIdx].id, note)} onClose={() => setEditNoteIdx(null)} />
      )}
    </div>
  );
}
