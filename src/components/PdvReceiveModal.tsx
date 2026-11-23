'use client';
import { useEffect, useState } from 'react';
import { BRL, showToast } from '@/lib/utils';
import { MarkPaidModal } from '@/components/MarkPaidModal';

// PDV: lista os pedidos recentes que ainda nao foram marcados como pagos para o
// operador confirmar o recebimento (PIX, dinheiro, cartao...) na mao.
export function PdvReceiveModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<any | null>(null);

  const load = async () => {
    const r = await fetch('/api/orders?light=1&limit=200').then((x) => x.json()).catch(() => []);
    // pega o que virou a noite tambem: 48h para tras em vez de so "hoje"
    const from = Date.now() - 48 * 60 * 60 * 1000;
    const list = (Array.isArray(r) ? r : []).filter((o: any) =>
      !o.paidAt && o.status !== 'cancelado' && o.number > 0 &&
      new Date(o.createdAt).getTime() >= from
    );
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const done = (r: any) => {
    setSel(null);
    showToast(r?.alreadyPaid ? `Pedido #${r.number} ja estava pago.` : `Pedido #${r?.number} marcado como pago (${r?.method || 'pago'}).`, 'success', 5000);
    load();
  };

  return (
    <div className="fixed inset-0 z-[75] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#1a1520', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Receber pagamento</p>
            <h3 className="text-sm font-black text-white">Pedidos em aberto (48h)</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white" style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {loading && <p className="text-xs text-gray-500 text-center py-6">Carregando...</p>}
          {!loading && rows.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-8">Nenhum pedido em aberto nas últimas 48h.</p>
          )}
          {rows.map((o) => (
            <button key={o.id} onClick={() => setSel(o)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="min-w-0">
                <p className="text-xs font-black text-white">#{o.number} <span className="font-bold text-gray-300">{o.customerName || 'PDV'}</span></p>
                <p className="text-[10px] text-gray-500">
                  {o.type === 'entrega' ? 'Entrega' : o.type === 'retirada' ? 'Retirada' : o.type === 'mesa' ? 'Mesa' : o.type === 'local' ? 'Local' : 'Balcão'}
                  {' • '}{String(o.payment || '').includes(',') ? 'dividido'
                    : o.status === 'aguardando_pagamento' || o.pixStatus === 'pending' ? 'PIX aguardando'
                    : (o.payment || '').toUpperCase() || '—'}
                  {' • '}{new Date(o.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-black text-white">{BRL(Number(o.total || 0))}</span>
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Receber</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {sel && <MarkPaidModal order={sel} onDone={done} onClose={() => setSel(null)} />}
    </div>
  );
}
