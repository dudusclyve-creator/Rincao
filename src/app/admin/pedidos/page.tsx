'use client';
import { useEffect, useRef, useState } from 'react';
import { BRL, playNewOrderSound, playDropSound, receiptText, printReceiptText, maskCpf } from '@/lib/utils';
import { printDanfe } from '@/lib/nfe-print';
import { Printer, Copy, X, ChevronDown, ChevronUp, Clock, MapPin, Truck, RotateCcw, Smartphone, Banknote, CreditCard, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';

const COLUMNS = [
  { id: 'novo', label: 'Novos', icon: '🔔', color: '#3b82f6', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.08))', border: 'rgba(59,130,246,0.35)' },
  { id: 'confirmado', label: 'Preparando', icon: '👨‍🍳', color: '#f59e0b', gradient: 'linear-gradient(135deg, rgba(251,146,60,0.2), rgba(251,146,60,0.08))', border: 'rgba(251,146,60,0.35)' },
  { id: 'pronto', label: 'Pronto', icon: '✅', color: '#8b5cf6', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.08))', border: 'rgba(139,92,246,0.35)' },
  { id: 'despachado', label: 'Saiu pra entrega', icon: '🛵', color: '#22c55e', gradient: 'linear-gradient(135deg, rgba(74,222,128,0.2), rgba(74,222,128,0.08))', border: 'rgba(74,222,128,0.35)' },
];

const STATUS_MAP: Record<string, string> = {
  novo: 'novo', confirmado: 'confirmado', preparo: 'confirmado', pronto: 'pronto',
  entrega: 'despachado', concluido: 'concluido', cancelado: 'cancelado',
};

const NEXT_STATUS: Record<string, { status: string; label: string; icon: string; color: string; deliveryOnly?: boolean }[]> = {
  novo: [{ status: 'confirmado', label: 'Aceitar', icon: '✅', color: '#3b82f6' }],
  confirmado: [{ status: 'pronto', label: 'Pronto', icon: '🔔', color: '#8b5cf6' }],
  pronto: [{ status: 'entrega', label: 'Saiu pra entrega', icon: '🛵', color: '#22c55e' }],
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

const OVERDUE_MIN = { novo: 15, confirmado: 30, preparo: 30, pronto: 45, despachado: 45 };

function isOverdue(o: any): boolean {
  const elapsed = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
  const limit = OVERDUE_MIN[o.status as keyof typeof OVERDUE_MIN];
  return limit ? elapsed > limit : false;
}

const PAYMENT_MAP: Record<string, { label: string; icon: string; color: string }> = {
  pix: { label: 'PIX', icon: '📱', color: '#22c55e' },
  dinheiro: { label: 'Dinheiro', icon: '💵', color: '#f59e0b' },
  debito: { label: 'Débito', icon: '💳', color: '#3b82f6' },
  credito: { label: 'Crédito', icon: '💳', color: '#8b5cf6' },
};

function getPaymentBadge(payment: string) {
  if (!payment) return null;
  if (payment.includes(',')) {
    const parts = payment.split(',');
    const labels = parts.map(p => {
      const [method, amount] = p.split(':');
      const info = PAYMENT_MAP[method];
      return info ? `${info.icon} ${info.label} ${BRL(Number(amount))}` : method;
    });
    return { label: labels.join(' + '), color: '#f59e0b' };
  }
  const info = PAYMENT_MAP[payment];
  return info ? { label: `${info.icon} ${info.label}`, color: info.color } : { label: payment, color: '#9ca3af' };
}

function OrderCard({ o, isSelected, onSelect, onStatus, onPrint, onDup, onCancel, onDispatch, onNfe, onEdit, draggable, onDragStart, onDragEnd }: any) {
  const orderType = getOrderType(o);
  const typeBadge = TYPE_BADGE[orderType];
  const isEnded = o.status === 'concluido' || o.status === 'cancelado';
  const endTimeMs = o.endedAt ? new Date(o.endedAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((endTimeMs - new Date(o.createdAt).getTime()) / 60000));
  const col = COLUMNS.find((c) => c.id === STATUS_MAP[o.status]);
  const isExpanded = true;
  const overdue = isEnded ? false : isOverdue(o);
  const wasOverdue = o.status === 'concluido' && o.endedAt ? elapsed > 45 : false;

  const troco = (() => {
    if (!o.changeFor || o.changeFor <= 0) return 0;
    if (o.payment?.includes(',')) {
      const cashAmount = o.payment.split(',').filter((p: string) => p.startsWith('dinheiro:')).reduce((s: number, p: string) => s + Number(p.split(':')[1] || 0), 0);
      return Math.max(0, o.changeFor - cashAmount);
    }
    return o.payment === 'dinheiro' ? Math.max(0, o.changeFor - o.total) : 0;
  })();

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
      onClick={() => onSelect(o.id)}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white">#{o.number}</span>
            {orderType === 'mesa' ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: '#581c87', color: '#d8b4fe' }}>📍 {o.addressText || 'Mesa'}</span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: typeBadge.bg, color: typeBadge.text }}>{typeBadge.label}</span>
            )}
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
            <p className="text-[13px] font-bold text-white truncate">{orderType === 'mesa' && (!o.customerName || o.customerName === 'PDV') ? (o.addressText || 'Mesa') : o.customerName}</p>
            <p className="text-[10px] flex items-center gap-1 flex-wrap" style={{ color: overdue ? '#f87171' : '#9ca3af' }}>
              <Clock size={9} /> {new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {isEnded && o.endedAt && <span> → {new Date(o.endedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
              {elapsed > 0 && <span> • {elapsed}min</span>}
              {overdue && <span className="font-bold text-red-400">⚠ atrasado</span>}
              {o.status === 'concluido' && wasOverdue && <span className="font-bold text-red-400">entregue atrasado</span>}
            </p>
          </div>
        </div>

        {(() => {
          const pay = getPaymentBadge(o.payment);
          if (!pay) return null;
          return (
            <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg" style={{ background: `${pay.color}12`, border: `1px solid ${pay.color}25` }}>
              <span className="text-[10px] font-bold" style={{ color: pay.color }}>{pay.label}</span>
            </div>
          );
        })()}
        {troco > 0 && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>💵 Troco {BRL(o.changeFor)} ({BRL(troco)})</span>
          </div>
        )}

        {isExpanded ? (
          <div className="space-y-1 mb-2 p-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {o.items.map((it: any) => {
              const addons = JSON.parse(it.addonsJson || '[]');
              return (
                <div key={it.id}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-300"><span className="font-bold text-white">{it.qty}x</span> {it.name}</span>
                    <span className="font-bold text-white">{BRL(it.unitPrice * it.qty)}</span>
                  </div>
                  {addons.map((a: any, j: number) => (
                    <p key={j} className="text-[9px] text-gray-500 ml-4">+ {a.name}{a.price ? ` ${BRL(a.price)}` : ''}</p>
                  ))}
                </div>
              );
            })}
            {o.addressText && (
              <div className="flex items-start gap-1 mt-2 pt-2 text-[10px] text-gray-400 border-t border-gray-700">
                <MapPin size={10} className="shrink-0 mt-0.5" /> {o.addressText}
              </div>
            )}
            {o.note && <p className="text-[10px] italic text-gray-400 mt-1">obs: {o.note}</p>}
            {o.driver && (() => {
              const motoboy = (o.note || '').match(/Motoboy:\s*([^|]+)/)?.[1]?.trim();
              return (
                <div className="flex items-center gap-1 mt-2 pt-2 text-[10px] font-bold text-purple-400 border-t border-gray-700">
                  <Truck size={10} /> {o.driver.name}{motoboy ? ` → ${motoboy}` : ''}{o.driver.phone ? ` — ${o.driver.phone}` : ''}
                </div>
              );
            })()}
            {(o.nfeStatus || o.status !== 'cancelado') && (() => {
              const chip = o.nfeStatus === 'issued' ? { t: `🧾 Nota fiscal emitida${o.nfeNumber ? ` #${o.nfeNumber}` : ''}`, c: '#4ade80' }
                : o.nfeStatus === 'error' ? { t: '⚠️ Erro na nota fiscal', c: '#f87171' }
                : o.nfeStatus === 'cancelled' ? { t: '❌ Nota fiscal cancelada', c: '#9ca3af' }
                : o.nfeStatus ? { t: o.nfeStatus === 'processing' ? '⏳ Nota processando...' : '🧾 Nota na fila...', c: '#60a5fa' }
                : { t: '🧾 Sem nota fiscal', c: '#f59e0b' };
              return (
                <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                  {(o.emitRequested || o.customer?.cpf) && o.nfeStatus !== 'issued' && o.nfeStatus !== 'cancelled' && (
                    <p className="text-[11px] font-bold" style={{ color: o.emitRequested ? '#f59e0b' : '#9ca3af' }}>
                      {o.emitRequested ? '🔔 Cliente pediu nota fiscal' : 'CPF informado'}{o.customer?.cpf ? ` — CPF: ${o.customer.cpf}` : ''}
                    </p>
                  )}
                  <p className="text-[10px] font-bold" style={{ color: chip.c }}>{chip.t}</p>
                  {o.nfeStatus === 'error' && o.nfeError && <p className="text-[9px] leading-snug" style={{ color: '#f87171' }}>{o.nfeError}</p>}
                  {o.nfeKey && <p className="text-[9px] text-gray-500 break-all">Chave: {o.nfeKey}</p>}
                  {o.nfeStatus === 'issued' && (
                    <div className="flex gap-1.5 pt-1">
                      <button onClick={(e) => { e.stopPropagation(); onNfe(o, 'danfe'); }} className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>📄 DANFE</button>
                      <button onClick={(e) => { e.stopPropagation(); window.open(`/api/nfe?orderId=${o.id}&doc=xml`, '_blank'); }} className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>XML</button>
                      <button onClick={(e) => { e.stopPropagation(); onNfe(o, 'cancel'); }} className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>✕ Cancelar nota</button>
                    </div>
                  )}
                </div>
              );
            })()}
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
        {NEXT_STATUS[STATUS_MAP[o.status]]?.map((next) => {
          const isDeliveryOrder = o.type === 'entrega' && !(o.addressText || '').toUpperCase().includes('RETIRADA') && !(o.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL');
          const toConcluido = next.status === 'entrega' && !isDeliveryOrder;
          const label = toConcluido ? 'Concluir' : next.label;
          const icon = toConcluido ? '✅' : next.icon;
          return (
            <button
              key={next.status}
              title={label}
              onClick={(e) => {
                e.stopPropagation();
                if (next.status === 'entrega') {
                  if (isDeliveryOrder) { onDispatch(o); return; }
                  onStatus(o.id, 'concluido');
                  return;
                }
                onStatus(o.id, next.status);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-bold text-white transition-all hover:brightness-110 active:scale-95"
              style={{ background: next.color }}
            >
              {icon} {label}
            </button>
          );
        })}
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
        {(o.nfeStatus || o.status !== 'cancelado') && (
          <button
            title={
              o.nfeStatus === 'issued' ? `Nota ${o.nfeNumber ? '#' + o.nfeNumber + ' ' : ''}— ver DANFE`
              : o.nfeStatus === 'error' ? 'Erro na nota — clique para tentar de novo'
              : o.nfeStatus === 'cancelled' ? 'Nota fiscal cancelada'
              : o.nfeStatus ? 'Nota fiscal processando — clique para atualizar'
              : 'Emitir nota fiscal'
            }
            onClick={(e) => { e.stopPropagation(); onNfe?.(o); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={
              o.nfeStatus === 'issued' ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
              : o.nfeStatus === 'error' ? { background: 'rgba(239,68,68,0.15)', color: '#f87171' }
              : o.nfeStatus === 'cancelled' ? { background: 'rgba(255,255,255,0.06)', color: '#6b7280' }
              : o.nfeStatus ? { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }
              : { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
            }
          >
            <FileText size={13} />
          </button>
        )}
        <button title="Imprimir pedido" onClick={(e) => { e.stopPropagation(); onPrint(o); }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
          <Printer size={13} />
        </button>
        <button title="Duplicar pedido" onClick={(e) => { e.stopPropagation(); onDup(o); }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
          <Copy size={13} />
        </button>
        {o.status !== 'cancelado' && (
          <button
            title={o.nfeStatus === 'issued' ? 'Nota emitida — cancele a nota para editar' : 'Editar pedido'}
            onClick={(e) => { e.stopPropagation(); onEdit(o); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: 'rgba(59,130,246,0.15)', color: o.nfeStatus === 'issued' ? '#60a5fa' : '#60a5fa' }}
          >
            <Pencil size={13} />
          </button>
        )}
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
  const [driverNote, setDriverNote] = useState<string>('');
  const [confirmPopup, setConfirmPopup] = useState<any | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState(1);

  const load = async () => {
    const o = await fetch('/api/orders?limit=120').then((r) => r.json());
    const turnoRes = await fetch('/api/cash').then((r) => r.json());
    const turnoId = String(turnoRes.turno || '1');
    const turnoOrders = o.filter((order: any) => (order.turnoId || '1') === turnoId);
    if (prevCount.current && turnoOrders.length > prevCount.current) playNewOrderSound();
    prevCount.current = turnoOrders.length;
    setOrders(turnoOrders);
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  useEffect(() => { fetch('/api/drivers').then((r) => r.json()).then(setDrivers); }, []);
  useEffect(() => { setDriverNote(''); }, [dispatchOrder]);

  const setStatus = async (id: string, status: string) => {
    await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  };

  const dispatchWithDriver = async (orderId: string, driverId: string, motoboy?: string) => {
    try {
      const payload: any = { id: orderId, status: 'entrega', driverId };
      if (motoboy?.trim()) payload.note = [confirmPopup?.note, `Motoboy: ${motoboy.trim()}`].filter(Boolean).join(' | ');
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setDispatchOrder(null);
      setConfirmPopup(null);
      setSelectedDriver('');
      setDriverNote('');
      load();
    } catch (e) {
      console.error('Erro ao despachar:', e);
    }
  };

  const print = async (o: any) => {
    const base = {
      store: 'Rincão Lanches', number: o.number, date: new Date(o.createdAt).toLocaleString('pt-BR'),
      customerName: o.customerName, customerPhone: o.customerPhone,
      items: o.items.map((it: any) => ({ qty: it.qty, name: it.name, unitPrice: it.unitPrice, addons: JSON.parse(it.addonsJson || '[]'), note: it.note })),
      payment: o.payment, subtotal: o.subtotal, fee: o.deliveryFee, discount: o.discount, total: o.total,
      addressText: o.addressText, type: o.type, driverName: o.driver?.name, motoboy: (o.note || '').match(/Motoboy:\s*([^|]+)/)?.[1]?.trim(), changeFor: o.changeFor,
      note: o.note || '',
      width: '80mm' as const,
    };
    const isFirst = !o.printCount;
    const pages = [receiptText(base)];
    // 1a impressao de entrega: sai junto a comanda do entregador
    if (isFirst && o.type === 'entrega') pages.push(receiptText({ ...base, variant: 'entregador' }));
    if (isFirst) {
      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, printed: true }) }).catch(() => {});
      o.printCount = (Number(o.printCount) || 0) + 1;
      load();
    }
    for (const p of pages) {
      await fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: p, printer: 'Padrao' }) }).catch(() => {});
    }
    printReceiptText(pages);
  };

  const escapeHtml = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

  const nfeApi = async (payload: any) => {
    const r = await fetch('/api/nfe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, d };
  };

  const pollNfe = (orderId: string) => {
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const { ok, d } = await nfeApi({ action: 'status', orderId });
      load();
      if (!ok || ['issued', 'error', 'cancelled'].includes(d.status) || n >= 15) clearInterval(t);
    }, 2000);
  };

  const emitNfe = async (o: any) => {
    if (!confirm(`Emitir nota fiscal (NFC-e) do pedido #${o.number}?`)) return;
    document.body.style.cursor = 'wait';
    const { ok, d } = await nfeApi({ action: 'emit', orderId: o.id });
    document.body.style.cursor = '';
    if (!ok) { alert(typeof d.error === 'string' ? d.error : JSON.stringify(d.error || 'Falha ao emitir a nota')); load(); return; }
    alert(`✅ Nota fiscal #${d.numero} emitida com sucesso!`);
    load();
  };

  const cancelNfe = async (o: any) => {
    const motivo = prompt('Motivo do cancelamento (mínimo 15 caracteres):', `Cancelamento do pedido #${o.number} solicitado pelo cliente`);
    if (!motivo) return;
    document.body.style.cursor = 'wait';
    const { ok, d } = await nfeApi({ action: 'cancel', orderId: o.id, motivo });
    document.body.style.cursor = '';
    if (!ok) { alert(typeof d.error === 'string' ? d.error : JSON.stringify(d.error || 'Falha ao cancelar a nota')); return; }
    alert('❌ Nota fiscal cancelada.');
    load();
  };

  const onNfe = (o: any, mode?: string) => {
    if (mode === 'cancel') { cancelNfe(o); return; }
    if (mode === 'danfe') { printDanfe(o); return; }
    if (o.nfeStatus === 'issued') { printDanfe(o); return; }
    if (o.nfeStatus === 'cancelled') { alert('Nota fiscal já cancelada.'); return; }
    if (o.nfeStatus === 'error') { emitNfe(o); return; }
    if (o.nfeStatus) { pollNfe(o.id); return; }
    emitNfe(o);
  };

  const openEdit = async (o: any) => {
    setEditOrder(o);
    setEditItems(o.items.map((it: any) => ({
      id: it.id, productId: it.productId || '', name: it.name, qty: it.qty, unitPrice: it.unitPrice,
      addons: JSON.parse(it.addonsJson || '[]'), note: it.note || '',
    })));
    setEditForm({
      customerName: o.customerName || '', customerPhone: o.customerPhone || '', addressText: o.addressText || '',
      type: o.type || 'entrega', deliveryFee: String(o.deliveryFee || 0), discount: String(o.discount || 0),
      payment: o.payment || 'pix', changeFor: o.changeFor ? String(o.changeFor) : '', note: o.note || '',
      customerCpf: o.customer?.cpf || '',
    });
    setAddProductId(''); setAddQty(1);
    const p = await fetch('/api/products').then((r) => r.json()).catch(() => []);
    setProducts(Array.isArray(p) ? p : []);
  };

  const saveEdit = async () => {
    if (!editOrder) return;
    if (editOrder.nfeStatus === 'issued') { alert('Nota fiscal emitida — cancele a nota antes de editar o pedido.'); return; }
    if (editItems.length === 0) { alert('O pedido precisa ter pelo menos 1 item.'); return; }
    const fee = editForm.type === 'entrega' ? Number(editForm.deliveryFee || 0) : 0;
    const payload: any = {
      action: 'edit', orderId: editOrder.id,
      items: editItems.map((it: any) => ({ productId: it.productId, name: it.name, qty: it.qty, unitPrice: it.unitPrice, addons: it.addons || [], note: it.note || '' })),
      customerName: editForm.customerName, customerPhone: editForm.customerPhone, addressText: editForm.addressText,
      customerCpf: editForm.customerCpf || '',
      type: editForm.type, deliveryFee: fee, discount: Number(editForm.discount || 0),
      changeFor: editForm.changeFor ? Number(editForm.changeFor) : null, note: editForm.note,
    };
    if (!String(editOrder.payment || '').includes(',')) payload.payment = editForm.payment;
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert(typeof d.error === 'string' ? d.error : 'Erro ao salvar as alterações'); return; }
    setEditOrder(null);
    load();
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
    playDropSound();
    if (!dragId || !colId) { setDragId(null); setDragOverCol(null); return; }
    const order = orders.find((o) => o.id === dragId);
    if (order && STATUS_MAP[order.status] !== colId) {
      if (colId === 'despachado' && order.type === 'entrega' && !(order.addressText || '').toUpperCase().includes('RETIRADA') && !(order.addressText || '').toUpperCase().includes('CONSUMO NO LOCAL')) {
        setDispatchOrder(order);
      } else {
        const targetStatus = colId === 'novo' ? 'novo' : colId === 'confirmado' ? 'confirmado' : colId === 'pronto' ? 'pronto' : 'entrega';
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
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
                  onStatus={setStatus} onPrint={print} onDup={dup} onCancel={setStatus} onDispatch={setDispatchOrder} onNfe={onNfe} onEdit={openEdit}
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
                <OrderCard key={o.id} o={o} isSelected={selectedOrder === o.id} onSelect={setSelectedOrder} onStatus={setStatus} onPrint={print} onDup={dup} onCancel={setStatus} onDispatch={setDispatchOrder} onNfe={onNfe} onEdit={openEdit} draggable={false} />
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
                <OrderCard key={o.id} o={o} isSelected={selectedOrder === o.id} onSelect={setSelectedOrder} onStatus={setStatus} onPrint={print} onDup={dup} onCancel={setStatus} onDispatch={setDispatchOrder} onNfe={onNfe} onEdit={openEdit} draggable={false} />
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

      {/* Modal editar pedido */}
      {editOrder && (() => {
        const subtotal = editItems.reduce((s: number, it: any) => s + it.qty * (it.unitPrice + (it.addons || []).reduce((a: number, x: any) => a + Number(x.price || 0) * Number(x.qty || 1), 0)), 0);
        const fee = editForm.type === 'entrega' ? Number(editForm.deliveryFee || 0) : 0;
        const discount = Number(editForm.discount || 0);
        const total = Math.max(0, subtotal + fee - discount);
        const nfeLocked = editOrder.nfeStatus === 'issued';
        const splitPay = String(editOrder.payment || '').includes(',');
        const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0e8e0' };
        const setItem = (idx: number, patch: any) => setEditItems((arr: any[]) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setEditOrder(null)}>
            <div className="rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto" style={{ background: '#1a1520', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ background: '#1a1520', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <h3 className="font-black text-base text-white flex items-center gap-2">✏️ Editar pedido #{editOrder.number}</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8a7a6a' }}>alterações valem para a produção e a impressão</p>
                </div>
                <button onClick={() => setEditOrder(null)} className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>
                  <X size={14} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {nfeLocked && (
                  <div className="px-4 py-3 rounded-xl text-[11px] font-bold" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}>
                    🧾 Nota fiscal #{editOrder.nfeNumber || ''} já emitida — cancele a nota antes de editar o pedido.
                  </div>
                )}

                {/* Itens */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#8a7a6a' }}>🍽️ Itens ({editItems.length})</label>
                  <div className="space-y-2">
                    {editItems.map((it: any, idx: number) => (
                      <div key={it.id || `new-${idx}`} className="p-2.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 shrink-0" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 2 }}>
                            <button onClick={() => setItem(idx, { qty: Math.max(1, it.qty - 1) })} className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm transition-all hover:brightness-125" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>−</button>
                            <span className="w-7 text-center text-[13px] font-black text-white">{it.qty}</span>
                            <button onClick={() => setItem(idx, { qty: it.qty + 1 })} className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm transition-all hover:brightness-125" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>+</button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-white truncate">{it.name}</p>
                            <p className="text-[10px] text-gray-500">{it.qty} × {BRL(it.unitPrice)}</p>
                          </div>
                          <span className="text-[12px] font-black shrink-0" style={{ color: '#4ade80' }}>{BRL(it.qty * (it.unitPrice + (it.addons || []).reduce((a: number, x: any) => a + Number(x.price || 0) * Number(x.qty || 1), 0)))}</span>
                          <button onClick={() => setEditItems((arr: any[]) => arr.filter((_, i) => i !== idx))} title="Remover item" className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <input
                          value={it.note} onChange={(e) => setItem(idx, { note: e.target.value })} placeholder="obs deste item (ex.: sem cebola)"
                          className="w-full mt-2 px-2.5 py-1.5 rounded-lg text-[11px] outline-none" style={{ ...inputStyle, color: '#f0e8e0' }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* adicionar item */}
                  <div className="flex gap-1.5 mt-2">
                    <select value={addProductId} onChange={(e) => setAddProductId(e.target.value)} className="flex-1 min-w-0 px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle}>
                      <option value="">+ Adicionar item do cardápio…</option>
                      {(products as any[]).filter((p: any) => p.available !== false).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} — {BRL(Number(p.promoPrice || p.price))}</option>
                      ))}
                    </select>
                    <input type="number" min={1} value={addQty} onChange={(e) => setAddQty(Math.max(1, Number(e.target.value || 1)))} className="w-14 px-2 py-2 rounded-xl text-[12px] text-center outline-none" style={inputStyle} />
                    <button
                      onClick={() => {
                        const p = (products as any[]).find((x: any) => x.id === addProductId);
                        if (!p) return;
                        setEditItems((arr: any[]) => [...arr, { id: `new-${Date.now()}`, productId: p.id, name: p.name, qty: addQty, unitPrice: Number(p.promoPrice || p.price), addons: [], note: '' }]);
                        setAddProductId(''); setAddQty(1);
                      }}
                      disabled={!addProductId}
                      className="px-3 rounded-xl text-[12px] font-bold text-white disabled:opacity-40 transition-all hover:brightness-110"
                      style={{ background: '#22c55e' }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Cliente e entrega */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>👤 Nome do cliente</label>
                    <input value={editForm.customerName} onChange={(e) => setEditForm((f: any) => ({ ...f, customerName: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>📱 Telefone</label>
                    <input value={editForm.customerPhone} onChange={(e) => setEditForm((f: any) => ({ ...f, customerPhone: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>📦 Tipo</label>
                    <select value={editForm.type} onChange={(e) => setEditForm((f: any) => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle}>
                      <option value="entrega">Entrega</option>
                      <option value="retirada">Retirada</option>
                      <option value="local">Consumo local</option>
                      <option value="mesa">Mesa</option>
                      <option value="balcao">Balcão</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>🪪 CPF (para emitir a nota fiscal)</label>
                    <input value={editForm.customerCpf || ''} onChange={(e) => setEditForm((f: any) => ({ ...f, customerCpf: maskCpf(e.target.value) }))} placeholder="000.000.000-00" className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>📍 Endereço / Mesa</label>
                    <input value={editForm.addressText} onChange={(e) => setEditForm((f: any) => ({ ...f, addressText: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>🛵 Taxa de entrega</label>
                    <input type="number" min={0} step="0.5" value={editForm.deliveryFee} onChange={(e) => setEditForm((f: any) => ({ ...f, deliveryFee: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>🏷️ Desconto</label>
                    <input type="number" min={0} step="0.5" value={editForm.discount} onChange={(e) => setEditForm((f: any) => ({ ...f, discount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>💳 Pagamento</label>
                    <select
                      value={splitPay ? editOrder.payment : editForm.payment}
                      onChange={(e) => setEditForm((f: any) => ({ ...f, payment: e.target.value }))}
                      disabled={splitPay}
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none disabled:opacity-50" style={inputStyle}
                    >
                      {splitPay && <option value={editOrder.payment}>{editOrder.payment} (dividido)</option>}
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>💵 Troco para</label>
                    <input type="number" min={0} step="0.5" value={editForm.changeFor} onChange={(e) => setEditForm((f: any) => ({ ...f, changeFor: e.target.value }))} placeholder="0,00" className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>📝 Observação do pedido</label>
                    <textarea rows={2} value={editForm.note} onChange={(e) => setEditForm((f: any) => ({ ...f, note: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none resize-none" style={inputStyle} />
                  </div>
                </div>

                {/* Totais */}
                <div className="p-3 rounded-xl space-y-1" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex justify-between text-[11px] text-gray-400"><span>Subtotal</span><span>{BRL(subtotal)}</span></div>
                  <div className="flex justify-between text-[11px] text-gray-400"><span>Taxa</span><span>{BRL(fee)}</span></div>
                  <div className="flex justify-between text-[11px] text-gray-400"><span>Desconto</span><span>− {BRL(discount)}</span></div>
                  <div className="flex justify-between text-[15px] font-black text-white pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}><span>Total</span><span style={{ color: '#4ade80' }}>{BRL(total)}</span></div>
                </div>
              </div>

              <div className="sticky bottom-0 flex gap-2 px-5 py-4" style={{ background: '#1a1520', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => setEditOrder(null)} className="flex-1 rounded-xl py-3 text-[12px] font-bold transition-all hover:scale-[1.02]" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>Cancelar</button>
                <button
                  disabled={nfeLocked || editItems.length === 0}
                  onClick={saveEdit}
                  className="flex-1 rounded-xl py-3 text-[12px] font-bold text-white disabled:opacity-40 transition-all hover:brightness-110 active:scale-95"
                  style={{ background: '#3b82f6' }}
                >
                  💾 Salvar alterações
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
              {(drivers as any[]).map((d: any) => (
                <button key={d.id} onClick={() => setSelectedDriver(d.id)} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left" style={selectedDriver === d.id ? { borderColor: '#22c55e', background: 'rgba(74,222,128,0.1)' } : { borderColor: 'rgba(255,255,255,0.12)', background: 'transparent' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: '#f0e8e0' }}>{d.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-white">{d.name}</p>
                    {d.phone && <p className="text-[10px] text-gray-400">{d.phone}</p>}
                  </div>
                  {selectedDriver === d.id && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#22c55e' }}>
                      <svg className="w-3 h-3" fill="none" stroke="#000" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    </div>
                  )}
                </button>
              ))}
              {(drivers as any[]).length === 0 && (
                <p className="text-center text-[11px] py-4 text-gray-500">Nenhum entregador cadastrado</p>
              )}
            </div>
            {(drivers as any[]).find((d: any) => d.id === selectedDriver)?.name?.match(/ponto/i) && (
              <div className="mb-5">
                <label className="block text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: '#8a7a6a' }}>✍️ Nome do motoboy (anotação)</label>
                <input value={driverNote} onChange={(e) => setDriverNote(e.target.value)} placeholder="Ex.: Joãozinho — quem tá levando hoje"
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none transition-all duration-200 hover:border-white/20 focus:border-amber-400/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0e8e0' }} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDispatchOrder(null)} className="flex-1 rounded-xl py-2.5 text-[11px] font-bold transition-all hover:scale-[1.02]" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>Cancelar</button>
              <button disabled={!selectedDriver} onClick={() => { setConfirmPopup(dispatchOrder); }} className="flex-1 rounded-xl py-2.5 text-[11px] font-bold text-white disabled:opacity-40 transition-all hover:brightness-110 active:scale-95" style={{ background: '#22c55e' }}>Confirmar envio</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup confirmação com lembretes */}
      {confirmPopup && (() => {
        const pay = confirmPopup.payment || '';
        const hasDinheiro = pay.includes('dinheiro');
        const hasCartao = pay.includes('debito') || pay.includes('credito');
        const hasBebida = confirmPopup.items?.some((it: any) => {
          const n = (it.name || '').toLowerCase();
          return n.includes('refri') || n.includes('cerv') || n.includes('suco') || n.includes('água') || n.includes('agua') || n.includes('饮') || n.includes('lata') || n.includes('garrafa') || n.includes('bebida') || n.includes('long neck') || n.includes('chopp') || n.includes('drink');
        });
        const trocoVal = (() => {
          if (!confirmPopup.changeFor || confirmPopup.changeFor <= 0) return 0;
          if (pay.includes(',')) {
            const cashAmount = pay.split(',').filter((p: string) => p.startsWith('dinheiro:')).reduce((s: number, p: string) => s + Number(p.split(':')[1] || 0), 0);
            return Math.max(0, confirmPopup.changeFor - cashAmount);
          }
          return pay === 'dinheiro' ? Math.max(0, confirmPopup.changeFor - confirmPopup.total) : 0;
        })();
        const reminders: { icon: string; text: string; color: string }[] = [];
        if (trocoVal > 0) reminders.push({ icon: '💵', text: `Levar troco ${BRL(confirmPopup.changeFor)} (${BRL(trocoVal)})`, color: '#f59e0b' });
        if (hasCartao) reminders.push({ icon: '💳', text: 'Levar maquininha', color: '#3b82f6' });
        if (hasBebida) reminders.push({ icon: '🍺', text: 'Levar bebidas', color: '#22c55e' });

        const driverName = (drivers as any[]).find((d: any) => d.id === selectedDriver)?.name || '';

        return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setConfirmPopup(null)}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1a1520', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }} onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.15)' }}>
                <span className="text-2xl">🛵</span>
              </div>
              <h3 className="font-black text-lg text-white">Confirmar despacho</h3>
              <p className="text-[12px] mt-1" style={{ color: '#8a7a6a' }}>Pedido #{confirmPopup.number} → {driverName}{driverNote.trim() ? ` (${driverNote.trim()})` : ''}</p>
            </div>

            {reminders.length > 0 && (
              <div className="space-y-2 mb-5">
                <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#8a7a6a' }}>⚠️ Lembrete para o motoboy</p>
                {reminders.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: `${r.color}12`, border: `1px solid ${r.color}30` }}>
                    <span className="text-lg">{r.icon}</span>
                    <span className="text-[12px] font-bold" style={{ color: r.color }}>{r.text}</span>
                  </div>
                ))}
              </div>
            )}

            {reminders.length === 0 && (
              <div className="mb-5 px-4 py-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[11px]" style={{ color: '#8a7a6a' }}>Nenhum lembrete especial</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setConfirmPopup(null)} className="flex-1 rounded-xl py-3 text-[12px] font-bold transition-all hover:scale-[1.02]" style={{ background: 'rgba(255,255,255,0.08)', color: '#c0b8c8' }}>Voltar</button>
              <button onClick={() => { dispatchWithDriver(confirmPopup.id, selectedDriver, driverNote); setConfirmPopup(null); }} className="flex-1 rounded-xl py-3 text-[12px] font-bold text-white transition-all hover:brightness-110 active:scale-95" style={{ background: '#22c55e' }}>✅ Confirmar</button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
