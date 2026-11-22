'use client';
import { useState } from 'react';
import { BRL } from '@/lib/utils';

// Confirma na mao o pagamento de um pedido (Pedidos e PDV). Sem Mercado Pago,
// sem webhook e sem taxa: o operador escolhe a forma e o valor entra no caixa.
const METHODS = [
  { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { id: 'pix', label: 'PIX', icon: '📱' },
  { id: 'debito', label: 'Débito', icon: '💳' },
  { id: 'credito', label: 'Crédito', icon: '💳' },
];

export function MarkPaidModal({ order, onDone, onClose }: {
  order: any;
  onDone: (r: any) => void;
  onClose: () => void;
}) {
  const initial = METHODS.some((m) => m.id === order?.payment) ? order.payment : 'dinheiro';
  const [method, setMethod] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const value = Math.round(Math.max(0, Number(order?.subtotal || 0) + Number(order?.deliveryFee || 0) - Number(order?.discount || 0)) * 100) / 100;

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const r = await fetch('/api/orders/paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, payment: method }),
    }).then((x) => x.json()).catch(() => null);
    setSaving(false);
    if (!r || r.error) {
      setError(r?.error || 'Nao foi possivel confirmar o pagamento');
      return;
    }
    onDone(r);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#1a1520', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Marcar como pago</p>
            <h3 className="text-sm font-black text-white">Pedido #{order?.number}</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{order?.customerName || ''}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white" style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
        </div>

        <p className="text-3xl font-black text-white mt-3 text-center">{BRL(value)}</p>
        <p className="text-[10px] text-gray-500 text-center mt-1">Valor da venda (sem taxa de cartão)</p>

        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-4 mb-1.5">Forma de pagamento</p>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className="py-2.5 rounded-xl text-xs font-bold transition-all"
              style={method === m.id
                ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.45)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {(method === 'debito' || method === 'credito') && Number(order?.cardFee || 0) === 0 && (
          <p className="text-[10px] text-gray-500 mt-2">Sem taxa de cartão neste pedido.</p>
        )}
        {(method === 'dinheiro' || method === 'pix') && Number(order?.cardFee || 0) > 0 && (
          <p className="text-[10px] mt-2" style={{ color: '#fbbf24' }}>A taxa de cartão ({BRL(Number(order.cardFee))}) sai do pedido.</p>
        )}

        {error && <p className="mt-2 text-[11px] font-bold" style={{ color: '#f87171' }}>{error}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: '#e5e7eb' }}>Voltar</button>
          <button onClick={confirm} disabled={saving} className="flex-1 py-2.5 rounded-xl text-xs font-black text-white disabled:opacity-60" style={{ background: '#16a34a' }}>
            {saving ? 'Confirmando...' : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
