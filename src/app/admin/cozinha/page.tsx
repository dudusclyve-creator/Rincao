'use client';
import { useEffect, useState, useMemo } from 'react';
import { ChefHat, Clock, AlertTriangle, Check, Flame, Timer } from 'lucide-react';

const STATUS_FLOW = ['novo', 'confirmado', 'preparo', 'pronto'];
const STATUS_NEXT: Record<string, string> = { novo: 'confirmado', confirmado: 'preparo', preparo: 'pronto' };
const STATUS_LABEL: Record<string, string> = { novo: 'NOVO', confirmado: 'ACEITO', preparo: 'PREPARO', pronto: 'PRONTO' };
const STATUS_COLOR: Record<string, string> = { novo: '#ef4444', confirmado: '#f59e0b', preparo: '#3b82f6', pronto: '#22c55e' };

function TimerBadge({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const calc = () => Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    setElapsed(calc());
    const t = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(t);
  }, [createdAt]);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  const isUrgent = elapsed > 900; // 15 min
  const isWarning = elapsed > 600; // 10 min
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold tabular-nums"
      style={{ color: isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#6b7280' }}>
      <Timer size={12} />
      {min}:{sec.toString().padStart(2, '0')}
      {isUrgent && <AlertTriangle size={12} className="animate-pulse" />}
    </span>
  );
}

export default function Cozinha() {
  const [orders, setOrders] = useState<any[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const load = async () => setOrders(await fetch('/api/orders?limit=60').then((r) => r.json()));
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const list = orders.filter((o) => ['novo', 'confirmado', 'preparo'].includes(o.status));
  const novoCount = list.filter(o => o.status === 'novo').length;

  const set = async (id: string, status: string) => {
    await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  };

  const sorted = useMemo(() => {
    return [...list].sort((a, b) => {
      const order: Record<string, number> = { novo: 0, confirmado: 1, preparo: 2 };
      const diff = (order[a.status as string] || 0) - (order[b.status as string] || 0);
      if (diff !== 0) return diff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [list]);

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <ChefHat size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Cozinha</h1>
            <p className="text-[10px] text-gray-500">
              {novoCount > 0 && <span style={{ color: '#ef4444' }}>{novoCount} novo(s) · </span>}
              {list.length} pedido(s) em andamento
            </p>
          </div>
        </div>
        {novoCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl animate-pulse" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Flame size={14} style={{ color: '#ef4444' }} />
            <span className="text-[11px] font-bold" style={{ color: '#ef4444' }}>{novoCount} NOVO(S)</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: 'Aguardando', count: list.filter(o => o.status === 'novo').length, color: '#ef4444' },
          { label: 'Em Preparo', count: list.filter(o => o.status === 'confirmado' || o.status === 'preparo').length, color: '#f59e0b' },
          { label: 'Prontos Hoje', count: orders.filter(o => o.status === 'pronto').length, color: '#22c55e' },
        ].map((s, i) => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: `${s.color}08`, border: `1px solid ${s.color}15` }}>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${s.color}99` }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {sorted.map((o, i) => {
          const next = STATUS_NEXT[o.status];
          const sColor = STATUS_COLOR[o.status];
          const isNew = o.status === 'novo';

          return (
            <div key={o.id} className="rounded-xl overflow-hidden transition-all duration-300"
              style={{
                background: isNew ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isNew ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                animation: `slideUp 0.3s ease ${i * 40}ms both`,
                boxShadow: isNew ? '0 0 20px rgba(239,68,68,0.05)' : 'none',
              }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: `2px solid ${sColor}20` }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white">#{o.number}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: `${sColor}15`, color: sColor }}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <TimerBadge createdAt={o.createdAt} />
              </div>

              {/* Items */}
              <div className="px-4 py-3 space-y-2">
                {o.items.map((it: any) => (
                  <div key={it.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black" style={{ color: sColor }}>{it.qty}x</span>
                      <span className="text-[13px] font-bold text-white">{it.name}</span>
                    </div>
                    {JSON.parse(it.addonsJson || '[]').length > 0 && (
                      <div className="ml-6 mt-0.5 space-y-0.5">
                        {JSON.parse(it.addonsJson || '[]').map((a: any, k: number) => (
                          <p key={k} className="text-[10px] text-gray-500">+ {a.name}</p>
                        ))}
                      </div>
                    )}
                    {it.note && (
                      <p className="ml-6 text-[10px] italic mt-0.5" style={{ color: '#f59e0b' }}>obs: {it.note}</p>
                    )}
                  </div>
                ))}
                {o.note && (
                  <div className="rounded-lg px-3 py-2 mt-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <p className="text-[11px] font-bold" style={{ color: '#f59e0b' }}>OBS: {o.note}</p>
                  </div>
                )}
                {o.type === 'entrega' && o.customerName && (
                  <p className="text-[10px] text-gray-600">🛵 {o.customerName}</p>
                )}
              </div>

              {/* Actions */}
              <div className="px-3 pb-3">
                {next && (
                  <button onClick={() => set(o.id, next)}
                    className="w-full py-2.5 rounded-xl text-[12px] font-bold text-white transition-all duration-200 active:scale-[0.98]"
                    style={{ background: next === 'pronto' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : `${STATUS_COLOR[next]}20`, color: next === 'pronto' ? '#fff' : STATUS_COLOR[next] }}>
                    {next === 'confirmado' && '✓ ACEITAR'}
                    {next === 'preparo' && '👨‍🍳 EM PREPARO'}
                    {next === 'pronto' && '✓ PRONTO'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-20">
          <ChefHat size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-lg font-bold text-gray-500">Cozinha limpa!</p>
          <p className="text-[11px] text-gray-600 mt-1">Nenhum pedido para preparar</p>
        </div>
      )}
    </div>
  );
}
