'use client';
import { useEffect, useRef, useState } from 'react';
import { BRL, ORDER_STATUS, STATUS_ORDER, playNewOrderSound, receiptText } from '@/lib/utils';
import { Play, CheckCircle2, Truck, XCircle, Printer, Copy, X, ChevronRight } from 'lucide-react';

const COLUMNS = [
  { id: 'novo', label: 'Novos', icon: '🔔', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { id: 'confirmado', label: 'Confirmados', icon: '✅', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'despachado', label: 'Despachados', icon: '🚚', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'cancelado', label: 'Cancelados', icon: '❌', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
];

const STATUS_MAP: Record<string, string> = {
  novo: 'novo',
  confirmado: 'confirmado',
  preparo: 'confirmado',
  pronto: 'confirmado',
  entrega: 'despachado',
  concluido: 'despachado',
  cancelado: 'cancelado',
};

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  novo: [{ status: 'confirmado', label: 'Confirmar' }],
  confirmado: [{ status: 'preparo', label: 'Preparar' }, { status: 'pronto', label: 'Pronto' }, { status: 'entrega', label: 'Despachar' }],
  despachado: [{ status: 'concluido', label: 'Concluir' }],
  cancelado: [],
};

const BADGE: Record<string, { bg: string; text: string; label: string }> = {
  novo: { bg: '#dc2626', text: '#fff', label: 'NOVO' },
  confirmado: { bg: '#2563eb', text: '#fff', label: 'CONFIRMADO' },
  preparo: { bg: '#d97706', text: '#fff', label: 'PREPARO' },
  pronto: { bg: '#059669', text: '#fff', label: 'PRONTO' },
  entrega: { bg: '#7c3aed', text: '#fff', label: 'ENTREGA' },
  concluido: { bg: '#059669', text: '#fff', label: 'CONCLUÍDO' },
  cancelado: { bg: '#6b7280', text: '#fff', label: 'CANCELADO' },
};

export default function Pedidos() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const prevCount = useRef(0);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [dispatchOrder, setDispatchOrder] = useState<any | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');

  const load = async () => {
    const o = await fetch('/api/orders?limit=120').then((r) => r.json());
    if (prevCount.current && o.length > prevCount.current) playNewOrderSound();
    prevCount.current = o.length;
    setOrders(o);
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  useEffect(() => { fetch('/api/users').then((r) => r.json()).then(setDrivers); }, []);

  const setStatus = async (id: string, status: string) => {
    await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  };

  const dispatchWithDriver = async (orderId: string, userId: string) => {
    const user = (drivers as any[]).find((u: any) => u.id === userId);
    const drvRes = await fetch('/api/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: user?.name || 'Entregador', phone: '' }) }).then((r) => r.json());
    await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: orderId, status: 'entrega', driverId: drvRes.id }) });
    setDispatchOrder(null);
    setSelectedDriver('');
    load();
  };
  const print = async (o: any) => {
    const text = receiptText({
      store: 'Rincão Lanches', number: o.number, date: new Date(o.createdAt).toLocaleString('pt-BR'),
      customerName: o.customerName, customerPhone: o.customerPhone,
      items: o.items.map((it: any) => ({ qty: it.qty, name: it.name, addons: JSON.parse(it.addonsJson || '[]'), note: it.note })),
      payment: o.payment, subtotal: o.subtotal, fee: o.deliveryFee, discount: o.discount, total: o.total, width: '80mm',
    });
    await fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, printer: 'Padrao' }) });
    const w = window.open('', '_blank', 'width=320');
    w?.document.write(`<pre class="receipt">${text}</pre><script>window.print()</script>`);
  };
  const dup = async (o: any) => {
    await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      customerName: o.customerName, customerPhone: o.customerPhone, addressText: o.addressText, type: o.type, payment: o.payment,
      subtotal: o.subtotal, deliveryFee: o.deliveryFee, source: 'pdv', note: o.note,
      items: o.items.map((it: any) => ({ productId: it.productId, name: it.name, qty: it.qty, unitPrice: it.unitPrice, addons: JSON.parse(it.addonsJson || '[]'), note: it.note })),
    })});
    load();
  };

  const grouped = COLUMNS.map((col) => ({
    ...col,
    orders: orders.filter((o) => STATUS_MAP[o.status] === col.id),
  }));

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black text-gray-900">Central de Pedidos</h1>
          <span className="text-[11px] text-gray-400">tempo real + som</span>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-gray-500 font-medium">AO VIVO</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {COLUMNS.map((col) => {
            const count = orders.filter((o) => STATUS_MAP[o.status] === col.id).length;
            return (
              <div key={col.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                <span className="text-xs">{col.icon}</span>
                <span className="text-[11px] font-bold" style={{ color: col.color }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 grid grid-cols-4 gap-3 min-h-0">
        {grouped.map((col) => (
          <div key={col.id} className="flex flex-col min-h-0 rounded-xl" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${col.border}` }}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{col.icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: col.color }}>{col.label}</span>
              </div>
              <span className="text-[11px] font-black rounded-full w-5 h-5 flex items-center justify-center" style={{ background: col.color, color: col.id === 'cancelado' ? '#fff' : '#fff' }}>{col.orders.length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {col.orders.length === 0 && (
                <div className="flex items-center justify-center h-24 text-[11px]" style={{ color: col.color, opacity: 0.5 }}>
                  Nenhum pedido
                </div>
              )}
              {col.orders.map((o) => {
                const badge = BADGE[o.status] || BADGE.novo;
                const isExpanded = selectedOrder === o.id;
                const elapsed = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
                return (
                  <div
                    key={o.id}
                    className="rounded-xl overflow-hidden cursor-pointer transition-all"
                    style={{
                      background: '#fff',
                      border: `1px solid ${col.border}`,
                      boxShadow: o.status === 'novo' ? `0 0 0 2px ${col.color}40, 0 2px 8px ${col.color}15` : '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                    onClick={() => setSelectedOrder(isExpanded ? null : o.id)}
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-black text-gray-800">#{o.number}</span>
                        <span className="text-[9px] text-gray-400">•</span>
                        <span className="text-[10px] text-gray-400">{new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {elapsed > 0 && <span className="text-[9px] text-gray-400">• {elapsed}min</span>}
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>{badge.label}</span>
                    </div>

                    {/* Card body */}
                    <div className="px-3 pb-2">
                      <p className="text-[12px] font-bold text-gray-800 truncate">{o.customerName}</p>
                      <p className="text-[10px] text-gray-400">{o.customerPhone} • {(() => { const t = o.type === 'retirada' || (o.addressText || '').toUpperCase().includes('RETIRADA') ? 'retirada' : o.type === 'local' || (o.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL') ? 'local' : 'entrega'; return t === 'entrega' ? '🛵 Entrega' : t === 'retirada' ? '🚶 Retirada' : '🍽 Local'; })()}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{o.items.length} {o.items.length === 1 ? 'item' : 'itens'} • {o.payment.toUpperCase()}</p>

                      {/* Items preview */}
                      <div className="mt-1.5 space-y-0.5">
                        {o.items.slice(0, isExpanded ? 99 : 2).map((it: any) => (
                          <div key={it.id} className="text-[10px] text-gray-600 flex items-start gap-1">
                            <span className="font-bold text-gray-800 shrink-0">{it.qty}x</span>
                            <span className="truncate">{it.name}</span>
                          </div>
                        ))}
                        {!isExpanded && o.items.length > 2 && (
                          <p className="text-[9px] text-gray-400">+{o.items.length - 2} mais...</p>
                        )}
                      </div>

                      {/* Address (expanded) */}
                      {isExpanded && o.addressText && (
                        <p className="text-[10px] text-gray-500 mt-1.5 px-2 py-1.5 rounded-lg" style={{ background: '#f9fafb' }}>📍 {o.addressText}</p>
                      )}

                      {/* Note (expanded) */}
                      {isExpanded && o.note && (
                        <p className="text-[10px] italic text-gray-500 mt-1">obs: {o.note}</p>
                      )}

                      {isExpanded && o.driver && (<p className="text-[10px] text-purple-600 mt-1 px-2 py-1.5 rounded-lg font-bold" style={{ background: "#ede9fe" }}>🛵 Entregador: {o.driver.name} — {o.driver.phone}</p>)}
                      {/* Price */}
                      <p className="font-extrabold text-sm mt-1.5" style={{ color: '#3a2010' }}>{BRL(o.total)}</p>
                    </div>

                    {/* Actions */}
                    <div className="px-3 py-2" style={{ borderTop: `1px solid ${col.border}40` }}>
                      {/* Next status buttons */}
                      {NEXT_STATUS[STATUS_MAP[o.status]]?.length > 0 && (
                        <div className="flex gap-1.5 mb-1.5">
                          {NEXT_STATUS[STATUS_MAP[o.status]].map((next) => (
                            <button
                              key={next.status}
                              onClick={(e) => { e.stopPropagation(); if (next.status === 'entrega') { const isDelivery = o.type === 'entrega' && !(o.addressText || '').toUpperCase().includes('RETIRADA') && !(o.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL'); if (isDelivery) { setDispatchOrder(o); return; } } setStatus(o.id, next.status); }}
                              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold text-white transition active:scale-[0.97]"
                              style={{ background: COLUMNS.find((c) => c.id === STATUS_MAP[next.status])?.color || '#6b7280' }}
                            >
                              {next.label}
                              <ChevronRight size={10} />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Secondary actions */}
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); print(o); }} className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-gray-600 transition"><Printer size={10} /> imprimir</button>
                        <button onClick={(e) => { e.stopPropagation(); dup(o); }} className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-gray-600 transition"><Copy size={10} /> duplicar</button>
                        {STATUS_MAP[o.status] !== 'cancelado' && (
                          <button onClick={(e) => { e.stopPropagation(); setStatus(o.id, 'cancelado'); }} className="flex items-center gap-1 text-[9px] text-red-400 hover:text-red-600 transition ml-auto"><X size={10} /> cancelar</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de selecao de entregador */}
      {dispatchOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDispatchOrder(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base text-gray-900">🛵 Despachar Pedido #{dispatchOrder.number}</h3>
              <button onClick={() => setDispatchOrder(null)} className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition"><X size={14} /></button>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">Selecione o entregador para <b>#{dispatchOrder.number}</b> ({dispatchOrder.customerName})</p>
            <div className="space-y-2 mb-4">
              {(drivers.filter((u: any) => u.role === 'entregador' && u.active)).map((d: any) => (
                <button key={d.id} onClick={() => setSelectedDriver(d.id)} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left" style={selectedDriver === d.id ? { borderColor: '#8b2e0a', background: '#8b2e0a08' } : { borderColor: '#e5e7eb' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "#8b2e0a" }}>{d.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-800">{d.name}</p>
                    <p className="text-[10px] text-gray-400">{d.email}</p>
                  </div>
                  {selectedDriver === d.id && (<div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#8b2e0a' }}><svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>)}
                </button>
              ))}
              {(drivers.filter((u: any) => u.role === 'entregador' && u.active)).length === 0 && (<p className="text-center text-[11px] text-gray-400 py-4">Nenhum entregador cadastrado. Cadastre em Equipe com role "entregador".</p>)}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDispatchOrder(null)} className="flex-1 rounded-xl py-2.5 text-[11px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition">Cancelar</button>
              <button disabled={!selectedDriver} onClick={() => dispatchWithDriver(dispatchOrder.id, selectedDriver)} className="flex-1 rounded-xl py-2.5 text-[11px] font-bold text-white disabled:opacity-40 transition" style={{ background: '#8b2e0a' }}>Confirmar envio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
