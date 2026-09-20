'use client';
import { useEffect, useState, useCallback } from 'react';
import { BRL, playDropSound } from '@/lib/utils';
import {
  Users, Plus, Minus, X, Search, ArrowRightLeft, Receipt,
  User, ChevronDown, ChevronUp, CreditCard, Banknote, Smartphone,
  Check, Trash2
} from 'lucide-react';

const PAYMENT_OPTIONS = [
  { id: 'pix', label: 'PIX', icon: Smartphone, color: '#22c55e' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: '#f59e0b' },
  { id: 'debito', label: 'Débito', icon: CreditCard, color: '#3b82f6' },
  { id: 'credito', label: 'Crédito', icon: CreditCard, color: '#8b5cf6' },
];

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
  const products = menu.products.filter((p: any) => {
    const matchCat = cat === 'all' || p.categoryId === cat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && p.available;
  });

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
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2">
            <button onClick={() => setCat('all')} className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold pdv-btn-hover"
              style={cat === 'all' ? { background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Todas</button>
            {menu.categories.map((c: any) => (
              <button key={c.id} onClick={() => setCat(c.id)} className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold pdv-btn-hover whitespace-nowrap"
                style={cat === c.id ? { background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>{c.name}</button>
            ))}
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
                  <div key={i} className="py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300">{it.qty}x {it.name}</span>
                      <span className="text-white font-bold">{BRL(itemTotal(it))}</span>
                    </div>
                    {addons.map((a: any, j: number) => (
                      <p key={j} className="text-[10px] text-gray-500 ml-3">+ {a.name}{a.price ? ` ${BRL(a.price)}` : ''}</p>
                    ))}
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

function CloseModal({ table, orders, onClose, onConfirm }: { table: any; orders: any[]; onClose: () => void; onConfirm: (payment: string, received: number) => void }) {
  const total = orders.reduce((s: number, o: any) => s + o.total, 0);
  const [payment, setPayment] = useState('pix');
  const [received, setReceived] = useState('');
  const receivedNum = parseFloat(received.replace(',', '.')) || 0;
  const change = payment === 'dinheiro' && receivedNum > total ? receivedNum - total : 0;

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
          <span className="text-xl font-black text-white">{BRL(total)}</span>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Forma de pagamento</p>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {PAYMENT_OPTIONS.map((p) => {
            const Icon = p.icon;
            return (
              <button key={p.id} onClick={() => { setPayment(p.id); setReceived(''); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold pdv-btn-hover"
                style={payment === p.id ? { background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}40` } : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Icon size={13} />{p.label}
              </button>
            );
          })}
        </div>
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
            {receivedNum > 0 && receivedNum < total && (
              <p className="text-[11px] text-red-400 font-bold mt-1 px-1">Valor insuficiente</p>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Cancelar</button>
          <button disabled={payment === 'dinheiro' && (receivedNum <= 0 || receivedNum < total)} onClick={() => onConfirm(payment, receivedNum)}
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

      <div className="space-y-1 mb-3 max-h-[200px] overflow-y-auto scrollbar-hide">
        {orders.map((o: any) => (
          <div key={o.id}>
            <p className="text-[9px] text-gray-600 mb-1">#{o.number}{o.customerName ? ` — ${o.customerName}` : ''}</p>
            {o.items?.map((it: any, i: number) => {
              const addons = JSON.parse(it.addonsJson || '[]');
              return (
                <div key={i} className="px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-all group">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 w-5 text-center">{it.qty}x</span>
                    <span className="text-[11px] text-white flex-1 truncate">{it.name}</span>
                    <span className="text-[11px] font-bold text-gray-300">{BRL(itemTotal(it))}</span>
                    <button onClick={() => removeItem(o.id, i)} className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all">
                      <Trash2 size={10} className="text-gray-500" />
                    </button>
                  </div>
                  {addons.map((a: any, j: number) => (
                    <p key={j} className="text-[10px] text-gray-500 ml-7">+ {a.name}{a.price ? ` ${BRL(a.price)}` : ''}</p>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
        {orders.length === 0 && <p className="text-[11px] text-gray-600 text-center py-4">Nenhum pedido</p>}
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
  const [modalTableId, setModalTableId] = useState<string | null>(null);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(true);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, o, m] = await Promise.all([
      fetch('/api/tables').then((r) => r.json()),
      fetch('/api/orders?limit=500').then((r) => r.json()),
      fetch('/api/menu').then((r) => r.json()),
    ]);
    setTables(t); setOrders(o); setMenu(m);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const closeTable = async (payment: string, received: number) => {
    if (!activeTableId) return;
    for (const o of activeOrders) {
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, status: 'concluido', payment }) });
      await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'movement', kind: 'venda', method: payment, amount: o.total, orderId: o.id, reason: `${activeTable?.number} #${o.number}` }) });
    }
    await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: activeTableId, status: 'livre' }) });
    setModalClose(null);
    load();
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
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Mesas</h1>
            <p className="text-[10px] text-gray-500">{tables.filter((t: any) => t.status === 'livre').length} livres · {tables.filter((t: any) => t.status === 'ocupada').length} ocupadas</p>
          </div>
        </div>
      </div>

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
                  {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
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

      <p className="text-[10px] text-gray-600 mt-4 text-center">Toque na mesa para expandir · Arraste uma mesa ocupada sobre uma livre para transferir</p>

      {modalAddItem && menu && !productModal && <AddItemModal menu={menu} onAdd={addItem} onSelectProduct={handleSelectProduct} onClose={closeAllModals} />}
      {productModal && <ProductModal product={productModal} onAdd={addItem} onClose={() => { setProductModal(null); setModalTableId(null); }} />}
      {modalTransfer && activeTable && <TransferModal table={activeTable} tables={tables} onTransfer={(destId) => transfer(destId)} onClose={closeAllModals} />}
      {modalBill && activeTable && <BillModal table={activeTable} orders={activeOrders} onClose={closeAllModals} />}
      {modalClose && activeTable && <CloseModal table={activeTable} orders={activeOrders} onClose={closeAllModals} onConfirm={closeTable} />}
    </div>
  );
}
