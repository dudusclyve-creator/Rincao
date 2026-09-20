'use client';
import { useEffect, useState, useMemo } from 'react';
import { BRL } from '@/lib/utils';
import { LayoutDashboard, TrendingUp, Receipt, Clock, ChefHat, CheckCircle2, XCircle, BarChart3, Wallet, Flame } from 'lucide-react';

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

function StatCard({ label, value, icon: Icon, color, sub, delay }: { label: string; value: string; icon: any; color: string; sub?: string; delay: number }) {
  return (
    <div className="rounded-2xl p-4 pdv-hover transition-all duration-300" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animationDelay: `${delay}ms`, animation: 'slideUp 0.5s ease both' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6b7280' }}>{label}</p>
          <p className="text-lg font-black text-white truncate">{value}</p>
          {sub && <p className="text-[10px] font-bold" style={{ color }}>{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function AnimatedBar({ value, max, color, label, amount, delay }: { value: number; max: number; color: string; label: string; amount: string; delay: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 group" style={{ animation: `slideUp 0.4s ease ${delay}ms both` }}>
      <span className="w-16 text-[11px] font-medium text-right shrink-0 text-gray-400">{label}</span>
      <div className="flex-1 h-7 rounded-lg overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div
          className="h-full rounded-lg transition-all duration-700 ease-out relative"
          style={{ width: `${pct}%`, background: `linear-gradient(to right, ${color}dd, ${color})`, transitionDelay: `${delay}ms` }}
        >
          <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)' }} />
        </div>
      </div>
      <span className="text-xs font-bold w-20 text-right shrink-0 text-white">{amount}</span>
    </div>
  );
}

function DonutSegment({ pct, color, label, value, totalPct }: { pct: number; color: string; label: string; value: string; totalPct: number }) {
  return (
    <div className="flex items-center gap-2.5 group">
      <div className="w-3 h-3 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125" style={{ background: color }} />
      <span className="text-xs flex-1 text-gray-400">{label}</span>
      <span className="text-xs font-bold text-white">{value}</span>
      <span className="text-[10px] font-medium w-10 text-right text-gray-500">{totalPct}%</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = ['#d4a574', '#9ca3af', '#cd7f32'];
  const bg = rank <= 3 ? colors[rank - 1] + '20' : 'rgba(255,255,255,0.04)';
  const text = rank <= 3 ? colors[rank - 1] : '#6b7280';
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
        const bg = intensity === 0 ? 'rgba(255,255,255,0.03)' : `rgba(225,29,72,${0.1 + intensity * 0.7})`;
        const textColor = intensity > 0.5 ? '#fff' : intensity > 0 ? '#e11d48' : '#6b7280';
        return (
          <div
            key={h}
            className="flex flex-col items-center justify-center rounded-lg py-2 pdv-hover cursor-default"
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
      { label: 'Vendas Hoje', value: BRL(d.hoje.vendas), icon: Wallet, color: '#22c55e' },
      { label: 'Pedidos Hoje', value: String(d.hoje.pedidos), icon: Receipt, color: '#e11d48' },
      { label: 'Ticket Médio', value: BRL(d.ticketMedio), icon: BarChart3, color: '#f59e0b' },
      { label: 'Pendentes', value: String(d.pendentes), icon: Clock, color: '#ef4444' },
      { label: 'Em Preparo', value: String(d.preparo), icon: ChefHat, color: '#f97316' },
      { label: 'Concluídos', value: String(d.concluidos), icon: CheckCircle2, color: '#22c55e' },
      { label: 'Cancelados', value: String(d.cancelados), icon: XCircle, color: '#6b7280' },
      { label: 'Faturamento', value: BRL(d.vendas), icon: TrendingUp, color: '#e11d48' },
    ];
  }, [d]);

  const payColors: Record<string, string> = { pix: '#22c55e', dinheiro: '#f59e0b', cartao: '#3b82f6', credito: '#8b5cf6', debito: '#06b6d4' };

  if (!d) return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5 flex items-center justify-center" style={{ background: '#1a1520' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-gray-500">Carregando dados...</p>
      </div>
    </div>
  );

  const maxDay = Math.max(1, ...Object.values(d.byDay as Record<string, number>).map(Number));
  const totalPay = Object.values(d.byPay).reduce((s: number, v: any) => s + v, 0) || 1;
  const maxHour = Math.max(1, ...Object.values(d.byHour as Record<string, number>));
  const hoursSorted: [string, number][] = Object.entries(d.byHour as Record<string, number>).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <LayoutDashboard size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Dashboard</h1>
            <p className="text-[10px] text-gray-500">Visão geral do restaurante</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
          <button
            onClick={toggleStore}
            disabled={toggling || isOpen === null}
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-white transition-all duration-300 pdv-btn-hover disabled:opacity-50"
            style={{ background: isOpen ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: isOpen ? '0 4px 14px rgba(34,197,94,0.3)' : '0 4px 14px rgba(239,68,68,0.3)' }}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current" />
            </span>
            {isOpen ? 'Loja Aberta' : 'Loja Fechada'}
          </button>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {[1, 7, 30].map((x) => (
              <button
                key={x}
                onClick={() => setDays(x)}
                className="px-3.5 py-2 text-xs font-semibold transition-all duration-200"
                style={{
                  background: days === x ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'rgba(255,255,255,0.04)',
                  color: days === x ? '#fff' : '#6b7280',
                }}
              >
                {x === 1 ? 'Hoje' : `${x}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 60} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-3 gap-4 mb-5">
        {/* Sales Bar Chart */}
        <div className="md:col-span-2 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: 'slideUp 0.5s ease 0.3s both' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white">Vendas por Dia</h3>
              <p className="text-[10px] mt-0.5 text-gray-500">Últimos {days} dias</p>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(225,29,72,0.1)' }}>
              <BarChart3 size={16} className="text-rose-400" />
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(d.byDay).map(([day, v]: any, i) => (
              <AnimatedBar
                key={day}
                value={v}
                max={maxDay}
                color="#e11d48"
                label={day.slice(5)}
                amount={BRL(v)}
                delay={i * 80 + 400}
              />
            ))}
          </div>
        </div>

        {/* Payment Donut */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: 'slideUp 0.5s ease 0.4s both' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white">Pagamentos</h3>
              <p className="text-[10px] mt-0.5 text-gray-500">Por forma</p>
            </div>
          </div>
          <div className="flex justify-center mb-5">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {(() => {
                  const C = 2 * Math.PI * 14;
                  let acc = 0;
                  return Object.entries(d.byPay).map(([k, v]: any) => {
                    const pct = (v / totalPay) * 100;
                    const len = (pct / 100) * C;
                    const dash = `${len} ${C - len}`;
                    const offset = -acc;
                    acc += len;
                    return (
                      <circle key={k} cx="18" cy="18" r="14" fill="none" stroke={payColors[k] || '#6b7280'} strokeWidth="4" strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="butt" className="transition-all duration-700" style={{ opacity: 0.85 }} />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-black text-white leading-tight">{BRL(totalPay)}</span>
                <span className="text-[8px] text-gray-500 mt-0.5">total</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(d.byPay).map(([k, v]: any) => (
              <DonutSegment key={k} pct={(v / totalPay) * 100} color={payColors[k] || '#6b7280'} label={k} value={BRL(v)} totalPct={Math.round((v / totalPay) * 100)} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: 'slideUp 0.5s ease 0.5s both' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white">Mais Vendidos</h3>
              <p className="text-[10px] mt-0.5 text-gray-500">Top {d.topProdutos.length} produtos</p>
            </div>
            <Flame size={16} className="text-amber-400" />
          </div>
          <div className="space-y-2">
            {d.topProdutos.map((p: any, i: number) => (
              <div
                key={p.name}
                className="flex items-center gap-3 p-2.5 rounded-xl pdv-hover"
                style={{ background: i === 0 ? 'rgba(225,29,72,0.05)' : 'transparent', animation: `slideUp 0.3s ease ${i * 60 + 500}ms both` }}
              >
                <RankBadge rank={i + 1} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate text-white">{p.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-white">{p.qty}x</p>
                  <p className="text-[10px] text-gray-500">{BRL(p.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Hours Heatmap */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: 'slideUp 0.5s ease 0.6s both' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white">Horários de Pico</h3>
              <p className="text-[10px] mt-0.5 text-gray-500">Pedidos por hora</p>
            </div>
            <Flame size={16} className="text-rose-400" />
          </div>
          <HourHeatmap hours={hoursSorted} max={maxHour} />
        </div>
      </div>
    </div>
  );
}
