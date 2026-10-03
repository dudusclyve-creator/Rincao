'use client';
import { useEffect, useState, useMemo } from 'react';
import { ChefHat, AlertTriangle, Flame, Timer, MessageSquare, PlusCircle } from 'lucide-react';

const STATUS_NEXT: Record<string, string> = { confirmado: 'preparo', preparo: 'pronto' };
const STATUS_LABEL: Record<string, string> = { confirmado: 'A PREPARAR', preparo: 'EM PREPARO', pronto: 'PRONTO' };
const STATUS_COLOR: Record<string, string> = { confirmado: '#f59e0b', preparo: '#3b82f6', pronto: '#22c55e' };

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  entrega: { label: 'ENTREGA', icon: '🛵', color: '#22c55e' },
  retirada: { label: 'RETIRADA', icon: '🏃', color: '#3b82f6' },
  mesa: { label: 'MESA', icon: '🍽️', color: '#f59e0b' },
  balcao: { label: 'BALCÃO', icon: '🧾', color: '#8b5cf6' },
};

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
  const isUrgent = elapsed > 900;
  const isWarning = elapsed > 600;
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

  const load = async () => setOrders(await fetch('/api/orders?limit=60').then((r) => r.json()));
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const pendingCount = orders.filter(o => o.status === 'novo').length;
  const list = orders.filter((o) => ['confirmado', 'preparo'].includes(o.status));

  const set = async (id: string, status: string) => {
    await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  };

  const sorted = useMemo(() => {
    return [...list].sort((a, b) => {
      const order: Record<string, number> = { preparo: 0, confirmado: 1 };
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
              {pendingCount > 0 && <span style={{ color: '#f59e0b' }}>{pendingCount} aguardando aceite · </span>}
              {list.length} pedido(s) na cozinha
            </p>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <Flame size={14} style={{ color: '#f59e0b' }} />
            <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>{pendingCount} SEM ACEITE</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Aguardando aceite', count: pendingCount, color: '#f59e0b' },
          { label: 'Na cozinha', count: list.length, color: '#3b82f6' },
          { label: 'Prontos Hoje', count: orders.filter(o => o.status === 'pronto').length, color: '#22c55e' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}>
            <p className="text-3xl font-black" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${s.color}99` }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((o, i) => {
          const next = STATUS_NEXT[o.status];
          const sColor = STATUS_COLOR[o.status] || '#f59e0b';
          const type = TYPE_META[o.type] || TYPE_META.balcao;
          const hasObs = !!o.note || o.items?.some((it: any) => it.note);

          return (
            <div key={o.id} className="rounded-xl overflow-hidden transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${sColor}30`,
                animation: `slideUp 0.3s ease ${i * 40}ms both`,
              }}>
              {/* Type strip */}
              <div className="px-4 py-2 flex items-center justify-between" style={{ background: `${type.color}12`, borderBottom: `1px solid ${type.color}25` }}>
                <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider" style={{ color: type.color }}>
                  <span>{type.icon}</span>
                  {o.type === 'mesa' && o.table?.number ? `MESA ${o.table.number}` : type.label}
                </span>
                {o.customerName && (
                  <span className="text-xs font-bold text-gray-400 truncate max-w-[55%] text-right">{o.customerName}</span>
                )}
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: `2px solid ${sColor}20` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white">#{o.number}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: `${sColor}15`, color: sColor }}>
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                </div>
                <TimerBadge createdAt={o.createdAt} />
              </div>

              {/* Order obs - emphasis */}
              {o.note && (
                <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-start gap-2"
                  style={{ background: 'rgba(245,158,11,0.15)', border: '2px solid rgba(245,158,11,0.5)' }}>
                  <MessageSquare size={16} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#f59e0b' }}>Observação do pedido</p>
                    <p className="text-sm font-bold text-white">{o.note}</p>
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="px-4 py-3 space-y-3">
                {o.items.map((it: any) => {
                  const addons = JSON.parse(it.addonsJson || '[]');
                  return (
                    <div key={it.id} className={`rounded-xl px-3 py-2.5 ${hasObs ? '' : ''}`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black" style={{ color: sColor }}>{it.qty}x</span>
                        <span className="text-[16px] font-bold text-white leading-tight">{it.name}</span>
                      </div>

                      {/* Addons - emphasis */}
                      {addons.length > 0 && (
                        <div className="ml-8 mt-2 flex flex-wrap gap-1.5">
                          {addons.map((a: any, k: number) => (
                            <span key={k} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black uppercase"
                              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.45)', color: '#c4b5fd' }}>
                              <PlusCircle size={11} />
                              {a.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Item obs - emphasis */}
                      {it.note && (
                        <div className="ml-8 mt-2 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
                          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.5)' }}>
                          <MessageSquare size={12} style={{ color: '#f59e0b' }} />
                          <span className="text-xs font-black" style={{ color: '#fbbf24' }}>OBS: {it.note}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
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
          <p className="text-xs text-gray-600 mt-1">Pedidos aceitos nos Pedidos aparecem aqui</p>
        </div>
      )}
    </div>
  );
}
