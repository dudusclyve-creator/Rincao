'use client';
import { useEffect, useState, useMemo } from 'react';
import { BRL } from '@/lib/utils';

const ACCENT = '#6b3a1f';
const ACCENT_LIGHT = '#b8906a';
const GREEN = '#16a34a';
const RED = '#dc2626';

function useAnimatedValue(target: number, duration = 600) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = val;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * ease);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

function StatCard({ label, value, icon, color, delay }: { label: string; value: string; icon: string; color: string; delay: number }) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-default"
      style={{ background: 'white', border: '1px solid #f0ebe5', animationDelay: `${delay}ms`, animation: 'slideUp 0.5s ease both' }}
    >
      <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] opacity-[0.07] transition-transform duration-300 group-hover:scale-125" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: ACCENT_LIGHT }}>{label}</p>
          <p className="text-2xl font-black mt-1" style={{ color: ACCENT }}>{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: color + '12', color }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function AnimatedBar({ value, max, color, label, amount, delay }: { value: number; max: number; color: string; label: string; amount: string; delay: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 group" style={{ animation: `slideUp 0.4s ease ${delay}ms both` }}>
      <span className="w-16 text-[11px] font-medium text-right shrink-0" style={{ color: ACCENT_LIGHT }}>{label}</span>
      <div className="flex-1 h-7 rounded-lg overflow-hidden relative" style={{ background: '#f5ebe0' }}>
        <div
          className="h-full rounded-lg transition-all duration-700 ease-out relative"
          style={{ width: `${pct}%`, background: `linear-gradient(to right, ${color}dd, ${color})`, transitionDelay: `${delay}ms` }}
        >
          <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)' }} />
        </div>
      </div>
      <span className="text-xs font-bold w-20 text-right shrink-0" style={{ color: ACCENT }}>{amount}</span>
    </div>
  );
}

function DonutSegment({ pct, color, label, value, totalPct }: { pct: number; color: string; label: string; value: string; totalPct: number }) {
  return (
    <div className="flex items-center gap-2.5 group" style={{ animation: 'slideUp 0.4s ease both' }}>
      <div className="w-3 h-3 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125" style={{ background: color }} />
      <span className="text-xs flex-1" style={{ color: ACCENT_LIGHT }}>{label}</span>
      <span className="text-xs font-bold" style={{ color: ACCENT }}>{value}</span>
      <span className="text-[10px] font-medium w-10 text-right" style={{ color: ACCENT_LIGHT }}>{totalPct}%</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = ['#d4a574', '#9ca3af', '#cd7f32'];
  const bg = rank <= 3 ? colors[rank - 1] + '20' : '#f5ebe0';
  const text = rank <= 3 ? colors[rank - 1] : ACCENT_LIGHT;
  return (
    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: bg, color: text }}>
      {rank}
    </span>
  );
}

function HourHeatmap({ hours, max }: { hours: [string, number][]; max: number }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {hours.map(([h, count], i) => {
        const intensity = max > 0 ? count / max : 0;
        const bg = intensity === 0 ? '#f5ebe0' : `rgba(107,58,31,${0.1 + intensity * 0.8})`;
        const textColor = intensity > 0.5 ? '#fff' : intensity > 0 ? ACCENT : ACCENT_LIGHT;
        return (
          <div
            key={h}
            className="flex flex-col items-center justify-center rounded-lg py-2 transition-all duration-200 hover:scale-105 cursor-default"
            style={{ background: bg, animation: `slideUp 0.3s ease ${i * 40}ms both` }}
          >
            <span className="text-[10px] font-bold" style={{ color: textColor }}>{h}</span>
            {count > 0 && <span className="text-[9px] font-medium mt-0.5" style={{ color: textColor + 'cc' }}>{count}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState<any>(null);
  const [days, setDays] = useState(7);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => { fetch(`/api/dashboard?days=${days}`).then((r) => r.json()).then(setD); }, [days]);
  useEffect(() => { fetch('/api/settings').then((r) => r.json()).then((r) => setIsOpen(r.isOpenManual === true)); }, []);

  const toggleStore = async () => {
    setToggling(true);
    const next = !isOpen;
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isOpenManual: next }) });
    setIsOpen(next);
    setToggling(false);
  };

  const stats = useMemo(() => {
    if (!d) return [];
    return [
      { label: 'Vendas Hoje', value: BRL(d.hoje.vendas), icon: '💰', color: '#16a34a' },
      { label: 'Pedidos Hoje', value: String(d.hoje.pedidos), icon: '🧾', color: '#6b3a1f' },
      { label: 'Ticket Médio', value: BRL(d.ticketMedio), icon: '📊', color: '#d97706' },
      { label: 'Pendentes', value: String(d.pendentes), icon: '⏳', color: '#dc2626' },
      { label: 'Em Preparo', value: String(d.preparo), icon: '👨‍🍳', color: '#ea580c' },
      { label: 'Concluídos', value: String(d.concluidos), icon: '✅', color: '#16a34a' },
      { label: 'Cancelados', value: String(d.cancelados), icon: '✕', color: '#9ca3af' },
      { label: 'Faturamento', value: BRL(d.vendas), icon: '📈', color: '#6b3a1f' },
    ];
  }, [d]);

  const payColors: Record<string, string> = { pix: '#16a34a', dinheiro: '#d97706', cartao: '#2563eb', crédito: '#7c3aed', débito: '#0891b2' };

  if (!d) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: ACCENT_LIGHT + '40', borderTopColor: ACCENT }} />
        <p className="text-sm font-medium" style={{ color: ACCENT_LIGHT }}>Carregando dados...</p>
      </div>
    </div>
  );

  const maxDay = Math.max(1, ...Object.values(d.byDay as Record<string, number>).map(Number));
  const totalPay = Object.values(d.byPay).reduce((s: number, v: any) => s + v, 0) || 1;
  const maxHour = Math.max(1, ...Object.values(d.byHour as Record<string, number>));
  const hoursSorted: [string, number][] = Object.entries(d.byHour as Record<string, number>).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-black" style={{ color: ACCENT }}>Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: ACCENT_LIGHT }}>Visão geral do seu restaurante</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleStore}
            disabled={toggling || isOpen === null}
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-white transition-all duration-300 hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
            style={{ background: isOpen ? GREEN : RED, boxShadow: isOpen ? '0 4px 14px rgba(22,163,74,0.3)' : '0 4px 14px rgba(220,38,38,0.3)' }}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'currentColor' }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current" />
            </span>
            {isOpen ? 'Loja Aberta' : 'Loja Fechada'}
          </button>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #e8e0d8' }}>
            {[1, 7, 30].map((x) => (
              <button
                key={x}
                onClick={() => setDays(x)}
                className="px-3.5 py-2 text-xs font-semibold transition-all duration-200"
                style={{
                  background: days === x ? ACCENT : 'white',
                  color: days === x ? 'white' : ACCENT_LIGHT,
                }}
              >
                {x === 1 ? 'Hoje' : `${x}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 60} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Sales Bar Chart */}
        <div className="md:col-span-2 rounded-2xl p-5" style={{ background: 'white', border: '1px solid #f0ebe5', animation: 'slideUp 0.5s ease 0.3s both' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: ACCENT }}>Vendas por Dia</h3>
              <p className="text-[10px] mt-0.5" style={{ color: ACCENT_LIGHT }}>Últimos {days} dias</p>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: ACCENT + '10' }}>
              <span className="text-sm">📊</span>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(d.byDay).map(([day, v]: any, i) => (
              <AnimatedBar
                key={day}
                value={v}
                max={maxDay}
                color={ACCENT}
                label={day.slice(5)}
                amount={BRL(v)}
                delay={i * 80 + 400}
              />
            ))}
          </div>
        </div>

        {/* Payment Donut */}
        <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #f0ebe5', animation: 'slideUp 0.5s ease 0.4s both' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: ACCENT }}>Pagamentos</h3>
              <p className="text-[10px] mt-0.5" style={{ color: ACCENT_LIGHT }}>Por forma</p>
            </div>
          </div>
          <div className="flex justify-center mb-5">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {(() => {
                  let acc = 0;
                  return Object.entries(d.byPay).map(([k, v]: any) => {
                    const pct = (v / totalPay) * 100;
                    const dash = `${pct} ${100 - pct}`;
                    const offset = -acc;
                    acc += pct;
                    return (
                      <circle key={k} cx="18" cy="18" r="14" fill="none" stroke={payColors[k] || '#9ca3af'} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" style={{ opacity: 0.85 }} />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black" style={{ color: ACCENT }}>{BRL(totalPay)}</span>
                <span className="text-[9px]" style={{ color: ACCENT_LIGHT }}>total</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(d.byPay).map(([k, v]: any) => (
              <DonutSegment key={k} pct={(v / totalPay) * 100} color={payColors[k] || '#9ca3af'} label={k} value={BRL(v)} totalPct={Math.round((v / totalPay) * 100)} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #f0ebe5', animation: 'slideUp 0.5s ease 0.5s both' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: ACCENT }}>Mais Vendidos</h3>
              <p className="text-[10px] mt-0.5" style={{ color: ACCENT_LIGHT }}>Top {d.topProdutos.length} produtos</p>
            </div>
            <span className="text-sm">🏆</span>
          </div>
          <div className="space-y-2">
            {d.topProdutos.map((p: any, i: number) => (
              <div
                key={p.name}
                className="flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 hover:shadow-sm group"
                style={{ background: i === 0 ? '#6b3a1f08' : 'transparent', animation: `slideUp 0.3s ease ${i * 60 + 500}ms both` }}
              >
                <RankBadge rank={i + 1} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: ACCENT }}>{p.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold" style={{ color: ACCENT }}>{p.qty}x</p>
                  <p className="text-[10px]" style={{ color: ACCENT_LIGHT }}>{BRL(p.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Hours Heatmap */}
        <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #f0ebe5', animation: 'slideUp 0.5s ease 0.6s both' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: ACCENT }}>Horários de Pico</h3>
              <p className="text-[10px] mt-0.5" style={{ color: ACCENT_LIGHT }}>Pedidos por hora</p>
            </div>
            <span className="text-sm">🔥</span>
          </div>
          <HourHeatmap hours={hoursSorted} max={maxHour} />
        </div>
      </div>
    </div>
  );
}
