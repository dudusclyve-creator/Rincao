'use client';
import { useEffect, useRef, useState } from 'react';
import { BRL, playNewOrderSound, receiptText } from '@/lib/utils';
import { Printer, Copy, X, ChevronDown, ChevronUp, Clock, MapPin, Truck, RotateCcw } from 'lucide-react';

const COLUMNS = [
  { id: 'novo', label: 'Novos', icon: '🔔', color: '#3b82f6', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.08))', border: 'rgba(59,130,246,0.35)' },
  { id: 'confirmado', label: 'Preparando', icon: '👨‍🍳', color: '#f59e0b', gradient: 'linear-gradient(135deg, rgba(251,146,60,0.2), rgba(251,146,60,0.08))', border: 'rgba(251,146,60,0.35)' },
  { id: 'despachado', label: 'Saiu pra entrega', icon: '🛵', color: '#22c55e', gradient: 'linear-gradient(135deg, rgba(74,222,128,0.2), rgba(74,222,128,0.08))', border: 'rgba(74,222,128,0.35)' },
];

const STATUS_MAP: Record<string, string> = {
  novo: 'novo', confirmado: 'confirmado', preparo: 'confirmado', pronto: 'despachado',
  entrega: 'despachado', concluido: 'concluido', cancelado: 'cancelado',
};

const NEXT_STATUS: Record<string, { status: string; label: string; icon: string; color: string; deliveryOnly?: boolean }[]> = {
  novo: [{ status: 'confirmado', label: 'Aceitar', icon: '✅', color: '#3b82f6' }],
  confirmado: [{ status: 'entrega', label: 'Saiu pra entrega', icon: '🛵', color: '#22c55e' }],
  despachado: [{ status: 'concluido', label: 'Concluir', icon: '✅', color: '#22c55e' }],
};

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  entrega: { bg: '#166534', text: '#86efac', label: 'ENTREGA' },
  retirada: { bg: '#7c2d12', text: '#fdba74', label: 'RETIRADA' },
  local: { bg: '#1e3a5f', text: '#93c5fd', label: 'LOCAL' },
  mesa: { bg: '#581c87', text: '#d8b4fe', label: 'MESA' },
  balcao: { bg: '#713f12', text: '#fde68a', label: 'BALCÃO' },
};

function getOrderType(o: any): string {
  if (o.type === 'retirada' || (o.addressText || '').toUpperCase().includes('RETIRADA')) return 'retirada';
  if (o.type === 'local' || (o.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL')) return 'local';
  if (o.type === 'mesa' || (o.addressText || '').toUpperCase().includes('MESA')) return 'mesa';
  if (o.type === 'balcao' || o.type === 'balcão') return 'balcao';
  return 'entrega';
}

const OVERDUE_MIN = { novo: 15, confirmado: 30, preparo: 30, despachado: 45 };

function isOverdue(o: any): boolean {
  const elapsed = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
  const limit = OVERDUE_MIN[o.status as keyof typeof OVERDUE_MIN];
  return limit ? elapsed > limit : false;
}

function OrderCard({ o, isSelected, onSelect, onStatus, onPrint, onDup, onCancel, onDispatch, draggable, onDragStart, onDragEnd }: any) {
  const orderType = getOrderType(o);
  const typeBadge = TYPE_BADGE[orderType];
  const elapsed = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
  const col = COLUMNS.find((c) => c.id === STATUS_MAP[o.status]);
  const isExpanded = isSelected;
  const overdue = isOverdue(o);
  const wasOverdue = o.status === 'concluido' || o.status === 'cancelado' ? elapsed > 45 : false;

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.setData('text/plain', o.id); e.dataTransfer.effectAllowed = 'move'; onDragStart?.(o.id); } : undefined}
      onDragEnd={draggable ? () => onDragEnd?.() : undefined}
      className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.01]"
      style={{
        background: col ? col.gradient : 'rgba(255,255,255,0.06)',
        border: overdue ? '2px solid #ef4444' : `1px solid ${col ? col.border : 'rgba(255,255,255,0.12)'}`,
        boxShadow: overdue ? '0 0 20px rgba(239,68,68,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
      onClick={() => onSelect(isExpanded ? null : o.id)}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white">#{o.number}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: typeBadge.bg, color: typeBadge.text }}>{typeBadge.label}</span>
            {overdue && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">ATRASADO</span>}
            {wasOverdue && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600/80 text-white">ATRASADO</span>}
          </div>
          <span className="text-xs font-bold text-white">{BRL(o.total)}</span>
        </div>

          <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#4a3a5a' }}>
            {o.customerName?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white truncate">{o.customerName}</p>
            <p className="text-[10px] flex items-center gap-1" style={{ color: overdue ? '#f87171' : '#9ca3af' }}>
              <Clock size={9} /> {new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {elapsed > 0 && <span> • {elapsed}min</span>}
              {overdue && <span className="font-bold text-red-400">⚠ atrasado</span>}
            </p>
          </div>
        </div>

        {isExpanded ? (
          <div className="space-y-1 mb-2 p-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {o.items.map((it: any) => (
              <div key={it.id} className="flex items-center justify-between text-[11px]">
                <span className="text-gray-300"><span className="font-bold text-white">{it.qty}x</span> {it.name}</span>
                <span className="font-bold text-white">{BRL(it.unitPrice * it.qty)}</span>
              </div>
            ))}
            {o.addressText && (
              <div className="flex items-start gap-1 mt-2 pt-2 text-[10px] text-gray-400 border-t border-gray-700">
                <MapPin size={10} className="shrink-0 mt-0.5" /> {o.addressText}
              </div>
            )}
            {o.note && <p className="text-[10px] italic text-gray-400 mt-1">obs: {o.note}</p>}
            {o.driver && (
              <div className="flex items-center gap-1 mt-2 pt-2 text-[10px] font-bold text-purple-400 border-t border-gray-700">
                <Truck size={10} /> {o.driver.name} — {o.driver.phone}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 mb-2">
            {o.items.slice(0, 2).map((it: any) => (
              <span key={it.id} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
                {it.qty}x {it.name}
              </span>
            ))}
            {o.items.length > 2 && (
              <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>+{o.items.length - 2}</span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {NEXT_STATUS[STATUS_MAP[o.status]]?.map((next) => (
          <button
            key={next.status}
            title={next.label}
            onClick={(e) => {
              e.stopPropagation();
              if (next.status === 'entrega') {
                const isDelivery = o.type === 'entrega' && !(o.addressText || '').toUpperCase().includes('RETIRADA') && !(o.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL');
                if (isDelivery) { onDispatch(o); return; }
              }
              onStatus(o.id, next.status);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-bold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: next.color }}
          >
            {next.icon} {next.label}
          </button>
        ))}
        {o.status === 'concluido' && isExpanded && (
          <button title="Reverter para despachado" onClick={(e) => { e.stopPropagation(); onStatus(o.id, 'entrega'); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-bold text-white transition-all hover:brightness-110 active:scale-95" style={{ background: '#7c3aed' }}>
            <RotateCcw size={11} /> Reverter
          </button>
        )}
        {o.status === 'cancelado' && isExpanded && (
          <button title="Reativar pedido" onClick={(e) => { e.stopPropagation(); onStatus(o.id, 'confirmado'); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-bold text-white transition-all hover:brightness-110 active:scale-95" style={{ background: '#22c55e' }}>
            <RotateCcw size={11} /> Reativar
          </button>
        )}
        <div className="flex-1" />
        <button title="Imprimir pedido" onClick={(e) => { e.stopPropagation(); onPrint(o); }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
          <Printer size={13} />
        </button>
        <button title="Duplicar pedido" onClick={(e) => { e.stopPropagation(); onDup(o); }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
          <Copy size={13} />
        </button>
        {!['cancelado', 'concluido'].includes(o.status) && (
          <button title="Cancelar pedido" onClick={(e) => { e.stopPropagation(); onCancel(o.id, 'cancelado'); }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Pedidos() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const prevCount = useRef(0);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [dispatchOrder, setDispatchOrder] = useState<any | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

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

  const handleDrop = async (colId: string) => {
    if (!dragId || !colId) { setDragId(null); setDragOverCol(null); return; }
    const order = orders.find((o) => o.id === dragId);
    if (order && STATUS_MAP[order.status] !== colId) {
      if (colId === 'despachado' && order.type === 'entrega' && !(order.addressText || '').toUpperCase().includes('RETIRADA') && !(order.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL')) {
        setDispatchOrder(order);
      } else {
        const targetStatus = colId === 'novo' ? 'novo' : colId === 'confirmado' ? 'confirmado' : 'entrega';
        await setStatus(order.id, targetStatus);
      }
    }
    setDragId(null);
    setDragOverCol(null);
  };

  const activeOrders = orders.filter((o) => ['novo', 'confirmado', 'preparo', 'pronto', 'entrega'].includes(o.status));
  const concluidos = orders.filter((o) => o.status === 'concluido');
  const cancelados = orders.filter((o) => o.status === 'cancelado');
  const grouped = COLUMNS.map((col) => ({ ...col, orders: activeOrders.filter((o) => STATUS_MAP[o.status] === col.id) }));
  const totalReceita = concluidos.reduce((s: number, o: any) => s + o.total, 0);


  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-2xl font-black text-white">Central de Pedidos</h1>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-500" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-[10px] font-bold text-green-400">AO VIVO</span>
            </div>
            <span className="text-[10px] text-gray-500">arraste para mover • toque para expandir</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {COLUMNS.map((col) => {
            const count = activeOrders.filter((o) => STATUS_MAP[o.status] === col.id).length;
            return (
              <div key={col.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold" style={{ background: col.color + '18', border: `1px solid ${col.border}`, color: col.color }}>
                <span className="text-xs">{col.icon}</span>
                <span className="text-[11px]">{count}</span>
                <span className="text-[9px] opacity-70 hidden sm:inline">{col.label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold" style={{ background: '#152a1a', border: '1px solid #254a30', color: '#22c55e' }}>
            <span className="text-[11px]">{concluidos.length}</span>
            <span className="text-[9px] opacity-70 hidden sm:inline">Feitos</span>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {grouped.map((col) => (
          <div
            key={col.id}
            className="flex flex-col rounded-xl overflow-hidden transition-all"
            style={{
              background: dragOverCol === col.id ? col.gradient : 'rgba(255,255,255,0.03)',
              border: dragOverCol === col.id ? `2px solid ${col.color}` : '1px solid rgba(255,255,255,0.08)',
            }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.id); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => { e.preventDefault(); handleDrop(col.id); }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <span className="text-base">{col.icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: col.color }}>{col.label}</span>
              </div>
              <span className="text-[11px] font-black rounded-lg px-2.5 py-1" style={{ background: col.color, color: '#fff' }}>{col.orders.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[140px] max-h-[calc(100vh-320px)] scrollbar-hide">
              {col.orders.length === 0 && (
                <div className="flex flex-col items-center justify-center h-28 text-[11px] font-medium rounded-xl border-2 border-dashed" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#5a5060' }}>
                  <span className="text-2xl mb-2 opacity-40">🍜</span>
                  {dragOverCol === col.id ? 'Solte aqui' : 'Nenhum pedido'}
                </div>
              )}
              {col.orders.map((o) => (
                <OrderCard
                  key={o.id} o={o} isSelected={selectedOrder === o.id} onSelect={setSelectedOrder}
                  onStatus={setStatus} onPrint={print} onDup={dup} onCancel={setStatus} onDispatch={setDispatchOrder}
                  draggable onDragStart={setDragId} onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Concluídos + Cancelados */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center px-5 py-3.5 transition-colors hover:bg-white/[0.02] relative">
          <div className="flex-1 flex justify-center items-center gap-3">
            <span className="text-base">✅</span>
            <span className="text-sm font-bold text-white">Concluídos</span>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold text-white" style={{ background: '#22c55e' }}>{concluidos.length}</span>
          </div>
          <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="flex-1 flex justify-center items-center gap-3">
            <span className="text-base">❌</span>
            <span className="text-sm font-bold text-white">Cancelados</span>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold text-white" style={{ background: '#6b7280' }}>{cancelados.length}</span>
          </div>
          <div className="absolute right-5">
            {showHistory ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
          </div>
        </button>
      </div>
      {showHistory && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="text-base">✅</span>
                <span className="text-sm font-bold text-white">Concluídos</span>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {concluidos.length === 0 && <p className="text-[11px] py-4 text-center" style={{ color: '#8a7a6a' }}>Nenhum</p>}
              {concluidos.map((o) => (
                <OrderCard key={o.id} o={o} isSelected={selectedOrder === o.id} onSelect={setSelectedOrder} onStatus={setStatus} onPrint={print} onDup={dup} onCancel={setStatus} onDispatch={setDispatchOrder} draggable={false} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="text-base">❌</span>
                <span className="text-sm font-bold text-white">Cancelados</span>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {cancelados.length === 0 && <p className="text-[11px] py-4 text-center" style={{ color: '#8a7a6a' }}>Nenhum</p>}
              {cancelados.map((o) => (
                <OrderCard key={o.id} o={o} isSelected={selectedOrder === o.id} onSelect={setSelectedOrder} onStatus={setStatus} onPrint={print} onDup={dup} onCancel={setStatus} onDispatch={setDispatchOrder} draggable={false} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex-1 text-center">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: '#8a7a6a' }}>Pedidos ativos</p>
          <p className="text-lg font-black text-white">{activeOrders.length}</p>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="flex-1 text-center">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: '#8a7a6a' }}>Receita</p>
          <p className="text-lg font-black text-green-400">{BRL(totalReceita)}</p>
        </div>
      </div>

      {/* Modal entregador */}
      {dispatchOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setDispatchOrder(null)}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1a1520', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-base" style={{ color: '#f0e8e0' }}>🛵 Despachar #{dispatchOrder.number}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: '#8a7a6a' }}>{dispatchOrder.customerName}</p>
              </div>
              <button onClick={() => setDispatchOrder(null)} className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 mb-5">
              {(drivers.filter((u: any) => u.role === 'entregador' && u.active)).map((d: any) => (
                <button key={d.id} onClick={() => setSelectedDriver(d.id)} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left" style={selectedDriver === d.id ? { borderColor: '#22c55e', background: 'rgba(74,222,128,0.1)' } : { borderColor: 'rgba(255,255,255,0.12)', background: 'transparent' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: '#f0e8e0' }}>{d.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-white">{d.name}</p>
                    <p className="text-[10px] text-gray-400">{d.email}</p>
                  </div>
                  {selectedDriver === d.id && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#22c55e' }}>
                      <svg className="w-3 h-3" fill="none" stroke="#000" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    </div>
                  )}
                </button>
              ))}
              {(drivers.filter((u: any) => u.role === 'entregador' && u.active)).length === 0 && (
                <p className="text-center text-[11px] py-4 text-gray-500">Nenhum entregador cadastrado</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDispatchOrder(null)} className="flex-1 rounded-xl py-2.5 text-[11px] font-bold transition-all hover:scale-[1.02]" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>Cancelar</button>
              <button disabled={!selectedDriver} onClick={() => dispatchWithDriver(dispatchOrder.id, selectedDriver)} className="flex-1 rounded-xl py-2.5 text-[11px] font-bold text-white disabled:opacity-40 transition-all hover:brightness-110 active:scale-95" style={{ background: '#22c55e' }}>Confirmar envio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
