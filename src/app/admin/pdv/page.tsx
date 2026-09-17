'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
import { ShoppingBag, Plus, Minus, CreditCard, Banknote, Smartphone, X, Search, Package } from 'lucide-react';

const TYPE_OPTIONS = [
  { id: 'balcao', label: 'Balcão', icon: 'Counter' },
  { id: 'mesa', label: 'Mesa', icon: 'Table' },
  { id: 'retirada', label: 'Retirada', icon: 'Package' },
  { id: 'entrega', label: 'Entrega', icon: 'Truck' },
];

const PAYMENT_OPTIONS = [
  { id: 'pix', label: 'PIX', icon: Smartphone, color: '#22c55e' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: '#f59e0b' },
  { id: 'debito', label: 'Débito', icon: CreditCard, color: '#3b82f6' },
  { id: 'credito', label: 'Crédito', icon: CreditCard, color: '#8b5cf6' },
];

export default function PDV() {
  const [menu, setMenu] = useState<any>(null);
  const [cat, setCat] = useState('all');
  const [cart, setCart] = useState<any[]>([]);
  const [type, setType] = useState('balcao');
  const [payment, setPayment] = useState('pix');
  const [discount, setDiscount] = useState(0);
  const [client, setClient] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  useEffect(() => { fetch('/api/menu').then((r) => r.json()).then(setMenu); }, []);

  if (!menu) {
    return (
      <div className="min-h-[calc(100vh-48px)] rounded-2xl p-5 flex items-center justify-center" style={{ background: '#1a1520' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-t-rose-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
          <p className="text-sm text-gray-400">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  const products = menu.products.filter((p: any) => {
    const matchCat = cat === 'all' || p.categoryId === cat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const sub = cart.reduce((s: number, i: any) => s + i.qty * i.unitPrice, 0);
  const total = Math.max(0, sub - discount);
  const itemCount = cart.reduce((s: number, i: any) => s + i.qty, 0);

  const addToCart = (p: any) => {
    setLastAdded(p.id);
    setTimeout(() => setLastAdded(null), 400);
    const ex = cart.find((i) => i.id === p.id);
    if (ex) setCart(cart.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
    else setCart([...cart, { id: p.id, name: p.name, unitPrice: p.promoPrice ?? p.price, qty: 1 }]);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((x) => x.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, qty: newQty } : i);
    });
  };

  const finish = async () => {
    const o = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: client || 'Balcão', customerPhone: '', addressText: type.toUpperCase(), type, payment,
        subtotal: sub, deliveryFee: 0, discount, source: 'pdv', note,
        items: cart.map((i) => ({ productId: i.id, name: i.name, qty: i.qty, unitPrice: i.unitPrice, addons: [], note: '' })),
      })
    }).then((r) => r.json());
    await fetch('/api/cash', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'movement', kind: 'venda', method: payment, amount: o.total, orderId: o.id, reason: `PDV #${o.number}` })
    });
    setCart([]); setDiscount(0); setNote(''); setClient('');
  };

  const C = '#1a1520';

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: C, color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <ShoppingBag size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">PDV</h1>
            <p className="text-[11px] text-gray-500">Balcão / Mesa / Retirada</p>
          </div>
        </div>
        {cart.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(225,29,72,0.15)' }}>
            <ShoppingBag size={14} className="text-rose-400" />
            <span className="text-xs font-bold text-rose-400">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Products */}
        <div className="flex-1 min-w-0">
          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }}
            />
          </div>

          {/* Categories */}
          <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setCat('all')}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
              style={cat === 'all'
                ? { background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff', boxShadow: '0 2px 12px rgba(225,29,72,0.3)' }
                : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              Todas
            </button>
            {menu.categories.map((c: any) => (
              <button
                key={c.id} onClick={() => setCat(c.id)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
                style={cat === c.id
                  ? { background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff', boxShadow: '0 2px 12px rgba(225,29,72,0.3)' }
                  : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {products.map((p: any, i: number) => {
              const inCart = cart.find(c => c.id === p.id);
              const justAdded = lastAdded === p.id;
              return (
                <button
                  key={p.id} disabled={!p.available}
                  onClick={() => addToCart(p)}
                  className="relative text-left rounded-2xl p-3.5 transition-all duration-200 group disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: justAdded
                      ? 'linear-gradient(135deg, rgba(225,29,72,0.15), rgba(225,29,72,0.05))'
                      : inCart
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.03)',
                    border: justAdded
                      ? '1px solid rgba(225,29,72,0.4)'
                      : inCart
                        ? '1px solid rgba(255,255,255,0.12)'
                        : '1px solid rgba(255,255,255,0.06)',
                    animation: justAdded ? 'cardPulse 0.4s ease' : undefined,
                  }}
                >
                  {inCart && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: '#e11d48' }}>
                      {inCart.qty}
                    </div>
                  )}
                  <p className="text-sm font-bold text-white leading-tight mb-1.5 pr-4">{p.name}</p>
                  <p className="text-xs font-black" style={{ color: p.promoPrice ? '#22c55e' : '#d4a574' }}>
                    {BRL(p.promoPrice ?? p.price)}
                  </p>
                  {p.promoPrice && (
                    <p className="text-[10px] line-through text-gray-600">{BRL(p.price)}</p>
                  )}
                </button>
              );
            })}
            {products.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
                <Package size={32} className="mb-2 opacity-40" />
                <p className="text-sm">Nenhum produto encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="w-full lg:w-[340px] flex-shrink-0">
          <div className="rounded-2xl overflow-hidden lg:sticky lg:top-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Cart Header */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-rose-400" />
                <span className="text-sm font-bold text-white">Venda</span>
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-[11px] text-gray-500 hover:text-red-400 transition-colors">
                  Limpar
                </button>
              )}
            </div>

            {/* Cart Items */}
            <div className="max-h-[240px] overflow-y-auto scrollbar-hide">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                  <ShoppingBag size={28} className="mb-2 opacity-30" />
                  <p className="text-xs">Carrinho vazio</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Toque em um produto</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {cart.map((i) => (
                    <div key={i.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 hover:bg-white/[0.03]">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{i.name}</p>
                        <p className="text-[10px] text-gray-500">{BRL(i.unitPrice)} un.</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQty(i.id, -1)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <Minus size={12} className="text-gray-400" />
                        </button>
                        <span className="text-xs font-bold text-white w-5 text-center">{i.qty}</span>
                        <button onClick={() => updateQty(i.id, 1)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <Plus size={12} className="text-gray-400" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-white w-16 text-right">{BRL(i.qty * i.unitPrice)}</p>
                      <button onClick={() => removeFromCart(i.id)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/20">
                        <X size={12} className="text-gray-500 hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <>
                {/* Divider */}
                <div className="mx-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                {/* Type */}
                <div className="px-4 pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Tipo</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TYPE_OPTIONS.map((t) => (
                      <button
                        key={t.id} onClick={() => setType(t.id)}
                        className="flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all duration-200"
                        style={type === t.id
                          ? { background: 'rgba(225,29,72,0.15)', color: '#fb7185', border: '1px solid rgba(225,29,72,0.3)' }
                          : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }
                        }
                      >
                        <span className="capitalize">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment */}
                <div className="px-4 pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Pagamento</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_OPTIONS.map((p) => {
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.id} onClick={() => setPayment(p.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200"
                          style={payment === p.id
                            ? { background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}40` }
                            : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }
                          }
                        >
                          <Icon size={14} />
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Client & Note */}
                <div className="px-4 pt-3 space-y-2">
                  <input
                    value={client} onChange={(e) => setClient(e.target.value)}
                    placeholder="Cliente (opcional)"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none transition-all duration-200"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }}
                  />
                  <input
                    value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="Observação"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none transition-all duration-200"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }}
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">R$</span>
                    <input
                      type="number" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value))}
                      placeholder="Desconto"
                      className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }}
                    />
                  </div>
                </div>

                {/* Total & Finish */}
                <div className="p-4 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400">Subtotal</span>
                    <span className="text-xs text-gray-400">{BRL(sub)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-green-400">Desconto</span>
                      <span className="text-xs text-green-400">-{BRL(discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-black text-white">Total</span>
                    <span className="text-lg font-black text-white">{BRL(total)}</span>
                  </div>
                  <button
                    onClick={finish}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #e11d48, #be123c)',
                      boxShadow: '0 4px 20px rgba(225,29,72,0.3)',
                    }}
                  >
                    Finalizar + Imprimir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
