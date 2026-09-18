'use client';
import { useEffect, useState, useRef } from 'react';
import { BRL } from '@/lib/utils';
import {
  Users, Plus, Minus, X, Search, ShoppingBag, ArrowRightLeft, Receipt,
  User, ChevronDown, ChevronUp, Package, CreditCard, Banknote, Smartphone,
  StickyNote, Printer, Check, Trash2
} from 'lucide-react';

const PAYMENT_OPTIONS = [
  { id: 'pix', label: 'PIX', icon: Smartphone, color: '#22c55e' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: '#f59e0b' },
  { id: 'debito', label: 'Débito', icon: CreditCard, color: '#3b82f6' },
  { id: 'credito', label: 'Crédito', icon: CreditCard, color: '#8b5cf6' },
];

function AddItemModal({ menu, onAdd, onClose }: { menu: any; onAdd: (item: any) => void; onClose: () => void }) {
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
              <button key={p.id} onClick={() => { onAdd({ productId: p.id, name: p.name, unitPrice: p.promoPrice ?? p.price, qty: 1, addons: [], note: '' }); onClose(); }}
                className="text-left rounded-xl p-3 pdv-hover" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {p.photoUrl ? <div className="w-full h-20 rounded-lg overflow-hidden mb-2"><img src={p.photoUrl} alt="" className="w-full h-full object-cover" /></div> : null}
                <p className="text-xs font-bold text-white truncate">{p.name}</p>
                <p className="text-[11px] font-black mt-0.5" style={{ color: p.promoPrice ? '#22c55e' : '#d4a574' }}>{BRL(p.promoPrice ?? p.price)}</p>
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
              <p className="text-[10px] text-gray-500 mb-1">Pedido #{o.number}</p>
              {o.items?.map((it: any, i: number) => (
                <div key={i} className="flex justify-between text-xs py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-gray-300">{it.qty}x {it.name}</span>
                  <span className="text-white font-bold">{BRL(it.qty * it.unitPrice)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
          <span className="text-sm font-bold text-gray-400">Total</span>
          <span className="text-xl font-black text-white">{BRL(total)}</span>
        </div>
        <div className="px-5 pb-5 pt-2">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-xs font-bold transition-all" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ table, tables, orders, onTransfer, onClose }: { table: any; tables: any[]; orders: any[]; onTransfer: (destId: string) => void; onClose: () => void }) {
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

function CloseModal({ table, orders, onClose, onConfirm }: { table: any; orders: any[]; onClose: () => void; onConfirm: (payment: string) => void }) {
  const total = orders.reduce((s: number, o: any) => s + o.total, 0);
  const [payment, setPayment] = useState('pix');
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-3">Fechar conta — {table.number}</h3>
        <div className="space-y-2 mb-4">
          {orders.map((o: any) => (
            <div key={o.id} className="flex justify-between text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <span className="text-gray-400">#{o.number}</span>
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
              <button key={p.id} onClick={() => setPayment(p.id)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold pdv-btn-hover"
                style={payment === p.id ? { background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}40` } : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Icon size={13} />{p.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Cancelar</button>
          <button onClick={() => onConfirm(payment)} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white pdv-btn-hover"
            style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function TableDetail({ table, orders, menu, tables, allOrders, load }: { table: any; orders: any[]; menu: any; tables: any[]; allOrders: any[]; load: () => void }) {
  const [clientName, setClientName] = useState(orders[0]?.customerName || '');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const total = orders.reduce((s: number, o: any) => s + o.total, 0);

  const saveClient = async () => {
    for (const o of orders) {
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, customerName: clientName }) });
    }
    load();
  };

  const addItem = async (item: any) => {
    if (orders.length === 0) {
      const o = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        customerName: clientName || table.number, customerPhone: '', addressText: table.number, type: 'mesa', payment: 'pix',
        subtotal: item.unitPrice, deliveryFee: 0, discount: 0, source: 'mesa', note: '', tableId: table.id,
        items: [item],
      })}).then((r) => r.json());
    } else {
      await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'addItems', orderId: orders[0].id, items: [item] }) });
    }
    load();
  };

  const removeItem = async (orderId: string, itemIdx: number) => {
    const o = allOrders.find((o: any) => o.id === orderId);
    if (!o) return;
    const newItems = o.items.filter((_: any, i: number) => i !== itemIdx);
    const newSubtotal = newItems.reduce((s: number, it: any) => s + it.qty * it.unitPrice, 0);
    for (const it of o.items) {
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, note: '' }) });
    }
    await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, discount: o.total - newSubtotal }) });
    load();
  };

  const transfer = async (destId: string) => {
    for (const o of orders) {
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, tableId: destId }) });
    }
    await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: table.id, status: 'livre' }) });
    await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: destId, status: 'ocupada' }) });
    load();
  };

  const closeTable = async (payment: string) => {
    for (const o of orders) {
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, status: 'concluido', payment }) });
      await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'movement', kind: 'venda', method: payment, amount: o.total, orderId: o.id, reason: `${table.number} #${o.number}` }) });
    }
    await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: table.id, status: 'livre' }) });
    load();
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
        <span className="text-xs font-bold text-white">{table.number}</span>
        <span className="text-[10px] text-gray-500">•</span>
        <span className="text-[10px] text-gray-500">{orders.length} pedido(s)</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} onBlur={saveClient}
            placeholder="Nome do cliente"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none transition-all duration-200 hover:border-white/20 focus:border-rose-500/50"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0e8e0' }} />
        </div>
      </div>

      <div className="space-y-1 mb-3 max-h-[200px] overflow-y-auto scrollbar-hide">
        {orders.map((o: any) => (
          <div key={o.id}>
            <p className="text-[9px] text-gray-600 mb-1">#{o.number}</p>
            {o.items?.map((it: any, i: number) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-all group">
                <span className="text-[11px] text-gray-400 w-5 text-center">{it.qty}x</span>
                <span className="text-[11px] text-white flex-1 truncate">{it.name}</span>
                <span className="text-[11px] font-bold text-gray-300">{BRL(it.qty * it.unitPrice)}</span>
                <button onClick={() => removeItem(o.id, i)} className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all">
                  <Trash2 size={10} className="text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        ))}
        {orders.length === 0 && <p className="text-[11px] text-gray-600 text-center py-4">Nenhum pedido</p>}
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-gray-400">Total</span>
        <span className="text-sm font-black text-white">{BRL(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setShowAddItem(true)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold pdv-btn-hover"
          style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' }}>
          <Plus size={13} /> Adicionar
        </button>
        <button onClick={() => setShowTransfer(true)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold pdv-btn-hover"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ArrowRightLeft size={13} /> Transferir
        </button>
        <button onClick={() => setShowBill(true)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold pdv-btn-hover"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Receipt size={13} /> Conta
        </button>
        <button onClick={() => setShowClose(true)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold pdv-btn-hover"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
          <Check size={13} /> Fechar
        </button>
      </div>

      {showAddItem && <AddItemModal menu={menu} onAdd={addItem} onClose={() => setShowAddItem(false)} />}
      {showTransfer && <TransferModal table={table} tables={tables} orders={orders} onTransfer={transfer} onClose={() => setShowTransfer(false)} />}
      {showBill && <BillModal table={table} orders={orders} onClose={() => setShowBill(false)} />}
      {showClose && <CloseModal table={table} orders={orders} onClose={() => setShowClose(false)} onConfirm={closeTable} />}
    </div>
  );
}

export default function Mesas() {
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [menu, setMenu] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    const [t, o, m] = await Promise.all([
      fetch('/api/tables').then((r) => r.json()),
      fetch('/api/orders?limit=500').then((r) => r.json()),
      fetch('/api/menu').then((r) => r.json()),
    ]);
    setTables(t); setOrders(o); setMenu(m);
  };

  useEffect(() => { load(); }, []);

  const C = '#1a1520';

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: C, color: '#f0e8e0' }}>
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

          return (
            <div key={t.id}
              className="rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer pdv-hover"
              style={{
                background: isExpanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                border: isFree ? '1px solid rgba(255,255,255,0.06)' : isOccupied ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(239,68,68,0.3)',
              }}
              onClick={() => setExpanded(isExpanded ? null : t.id)}>
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
                  <TableDetail table={t} orders={tbOrders} menu={menu} tables={tables} allOrders={orders} load={load} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-600 mt-4 text-center">Toque na mesa para expandir • QR Code: /cardapio?mesa=Mesa 01</p>
    </div>
  );
}
