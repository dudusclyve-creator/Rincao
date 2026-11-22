'use client';
import { useState } from 'react';
import { BRL } from '@/lib/utils';
import { PixQr } from '@/components/PixQr';

// PIX manual (Pedidos): "copia e cola" gerado na chave da loja, sem Mercado
// Pago, sem taxa e sem webhook. O QR cobra o valor do pedido e quem confirma o
// recebimento e o operador (depois de conferir no banco).
export function PixChargeModal({ charge, onConfirmed, onClose }: {
  charge: { orderId: string; number: number; total: number; payload: string; merchant?: string };
  onConfirmed: (r: any) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState('');

  const copy = async () => {
    try { await navigator.clipboard.writeText(String(charge?.payload || '')); } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = String(charge?.payload || '');
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirm = async () => {
    if (confirming) return;
    setConfirming(true);
    setError('');
    const r = await fetch('/api/orders/paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: charge.orderId, payment: 'pix' }),
    }).then((x) => x.json()).catch(() => null);
    setConfirming(false);
    if (!r || r.error) {
      setError(r?.error || 'Falha ao confirmar o pagamento');
      return;
    }
    onConfirmed(r);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-5 text-center" style={{ background: '#241016', border: '1px solid #3a2028', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-left min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">PIX manual</p>
            <h3 className="text-sm font-black text-white">Pedido #{charge.number}</h3>
            {charge.merchant && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{charge.merchant}</p>}
          </div>
          <button onClick={onClose} title="Fechar" className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white" style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
        </div>

        <p className="text-3xl font-black text-white mt-3">{BRL(Number(charge.total || 0))}</p>
        <p className="text-[10px] font-bold mt-1" style={{ color: '#4ade80' }}>PIX • 0% de taxa — cai direto na sua chave</p>

        <div className="flex justify-center mt-3 rounded-xl bg-white p-2">
          <PixQr value={charge.payload} size={210} />
        </div>

        <button onClick={copy} className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold transition-all"
          style={copied ? { background: '#16a34a', color: '#fff' } : { background: 'rgba(255,255,255,0.08)', color: '#e5e7eb' }}>
          {copied ? '✅ Código copiado' : '📋 Copiar código copia e cola'}
        </button>

        <p className="text-[10px] text-gray-500 mt-2 leading-snug">
          O sistema não confirma sozinho. Confira o valor na conta e confirme abaixo.
        </p>

        {error && <p className="mt-2 text-[11px] font-bold" style={{ color: '#f87171' }}>{error}</p>}

        {!ask ? (
          <button onClick={() => setAsk(true)} className="w-full mt-3 py-2.5 rounded-xl text-xs font-black text-white pdv-btn-hover"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 20px rgba(22,163,74,0.3)' }}>
            ✅ Já recebi o PIX
          </button>
        ) : (
          <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <p className="text-[11px] font-bold text-white">Confirma o recebimento de {BRL(Number(charge.total || 0))}?</p>
            <p className="text-[10px] text-gray-400 mt-0.5">O pedido fica como pago em PIX e entra no caixa.</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setAsk(false)} disabled={confirming} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: '#e5e7eb' }}>
                Voltar
              </button>
              <button onClick={confirm} disabled={confirming} className="flex-1 py-2 rounded-lg text-[11px] font-black text-white disabled:opacity-60" style={{ background: '#16a34a' }}>
                {confirming ? 'Confirmando...' : 'Sim, recebi'}
              </button>
            </div>
          </div>
        )}

        <button onClick={onClose} className="w-full mt-2 py-2 text-[10px] font-bold text-gray-500 hover:text-white transition-colors">
          Fechar sem confirmar
        </button>
      </div>
    </div>
  );
}
