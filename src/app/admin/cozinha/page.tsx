'use client';
import { useEffect, useState, useMemo } from 'react';
import { ChefHat, Clock, AlertTriangle, Check, Flame, Timer } from 'lucide-react';

const STATUS_FLOW = ['novo', 'confirmado', 'preparo', 'pronto'];
const STATUS_NEXT: Record<string, string> = { novo: 'preparo', confirmado: 'preparo', preparo: 'pronto' };
const STATUS_LABEL: Record<string, string> = { novo: 'NOVO', confirmado: 'PREPARO', preparo: 'PREPARO', pronto: 'PRONTO' };
const STATUS_COLOR: Record<string, string> = { novo: '#f59e0b', confirmado: '#3b82f6', preparo: '#3b82f6', pronto: '#22c55e' };

function TimerBadge({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const calc = () => Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    setElapsed(calc());
    const t = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(t);
  }, [createdAt]);
  const hours = Math.floor(elapsed / 3600);
  const min = Math.floor((elapsed % 3600) / 60);
  const sec = elapsed % 60;
  const isUrgent = elapsed > 900; // 15 min
  const isWarning = elapsed > 600; // 10 min
  const time = hours > 0
    ? `${hours}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    : `${min}:${sec.toString().padStart(2, '0')}`;
  return (
    <span className="flex items-center gap-1 text-xs font-bold tabular-nums"
      style={{ color: isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#6b7280' }}>
      <Timer size={13} />
      {time}
      {isUrgent && <AlertTriangle size={13} className="animate-pulse" />}
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <ChefHat size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Cozinha</h1>
            <p className="text-xs text-gray-500">
              {novoCount > 0 && <span style={{ color: '#f59e0b' }}>{novoCount} novo(s) · </span>}
              {list.length} pedido(s) em andamento
            </p>
          </div>
        </div>
        {novoCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <Flame size={14} style={{ color: '#f59e0b' }} />
            <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>{novoCount} AGUARDANDO</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Aguardando', count: list.filter(o => o.status === 'novo').length, color: '#f59e0b' },
          { label: 'Em Preparo', count: list.filter(o => o.status === 'confirmado' || o.status === 'preparo').length, color: '#3b82f6' },
          { label: 'Prontos Hoje', count: orders.filter(o => o.status === 'pronto').length, color: '#22c55e' },
        ].map((s, i) => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}>
            <p className="text-3xl font-black" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${s.color}99` }}>{s.label}</p>
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
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${isNew ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)'}`,
                animation: `slideUp 0.3s ease ${i * 40}ms both`,
              }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: `2px solid ${sColor}20` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white">#{o.number}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: `${sColor}15`, color: sColor }}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <TimerBadge createdAt={o.createdAt} />
              </div>

              {/* Items */}
              <div className="px-4 py-3 space-y-2.5">
                {o.items.map((it: any) => (
                  <div key={it.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black" style={{ color: sColor }}>{it.qty}x</span>
                      <span className="text-[15px] font-bold text-white">{it.name}</span>
                    </div>
                    {JSON.parse(it.addonsJson || '[]').length > 0 && (
                      <div className="ml-7 mt-0.5 space-y-0.5">
                        {JSON.parse(it.addonsJson || '[]').map((a: any, k: number) => (
                          <p key={k} className="text-xs text-gray-500">+ {a.name}</p>
                        ))}
                      </div>
                    )}
                    {it.note && (
                      <p className="ml-7 text-xs italic mt-0.5" style={{ color: '#f59e0b' }}>obs: {it.note}</p>
                    )}
                  </div>
                ))}
                {o.note && (
                  <div className="rounded-lg px-3 py-2 mt-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>OBS: {o.note}</p>
                  </div>
                )}
                {o.type === 'entrega' && o.customerName && (
                  <p className="text-xs text-gray-600">🛵 {o.customerName}</p>
                )}
              </div>

              {/* Actions */}
              <div className="px-3 pb-3">
                {next && (
                  <button onClick={() => set(o.id, next)}
                    className="w-full py-4 rounded-xl text-[15px] font-bold text-white transition-all duration-200 active:scale-[0.98]"
                    style={next === 'pronto'
                      ? { background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.25)' }
                      : { background: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.35)' }}>
                    {next === 'preparo' && '👨‍🍳 PREPARAR'}
                    {next === 'pronto' && '✓ PEDIDO PRONTO'}
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
