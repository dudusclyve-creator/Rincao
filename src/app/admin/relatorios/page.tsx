'use client';
import { useEffect, useState, useMemo } from 'react';
import { BRL } from '@/lib/utils';
import { BarChart3, Download, TrendingUp, ShoppingCart, DollarSign, Users, Calendar, Filter } from 'lucide-react';

type Data = {
  summary: { totalOrders: number; activeOrders: number; cancelledOrders: number; revenue: number; avgTicket: number };
  byPayment: Record<string, number>;
  byType: Record<string, { count: number; total: number }>;
  topProducts: { name: string; qty: number; total: number }[];
  dailyData: [string, { count: number; total: number }][];
  byHour: Record<number, number>;
  orders: any[];
};

const PAYMENT_COLORS: Record<string, string> = { pix: '#22c55e', dinheiro: '#f59e0b', debito: '#3b82f6', credito: '#a855f7' };
const PAYMENT_LABELS: Record<string, string> = { pix: 'PIX', dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito' };
const TYPE_LABELS: Record<string, string> = { entrega: 'Entrega', retirada: 'Retirada', mesa: 'Mesa' };
const TYPE_COLORS: Record<string, string> = { entrega: '#22c55e', retirada: '#f59e0b', mesa: '#3b82f6' };

function BarChartSVG({ data, maxVal }: { data: { label: string; value: number; color?: string }[]; maxVal: number }) {
  const barW = 36, gap = 8, h = 120, chartW = data.length * (barW + gap);
  return (
    <svg width="100%" viewBox={`0 0 ${chartW + 20} ${h + 24}`} className="overflow-visible">
      {data.map((d, i) => {
        const barH = maxVal > 0 ? (d.value / maxVal) * h : 0;
        const x = i * (barW + gap) + 10;
        return (
          <g key={i}>
            <rect x={x} y={h - barH} width={barW} height={barH} rx={4} fill={d.color || '#e11d48'} opacity={0.85} />
            <text x={x + barW / 2} y={h + 14} textAnchor="middle" fill="#6b7280" fontSize={8}>{d.label}</text>
            {d.value > 0 && <text x={x + barW / 2} y={h - barH - 4} textAnchor="middle" fill="#f0e8e0" fontSize={8} fontWeight={700}>{d.value}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function DonutSVG({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-[11px] text-gray-600 text-center py-4">Sem dados</p>;
  const r = 40, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={100} height={100} viewBox="0 0 100 100">
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = C * pct;
          const offset = C * (1 - acc);
          acc += pct;
          return <circle key={i} cx={50} cy={50} r={r} fill="none" stroke={d.color} strokeWidth={12} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={offset} strokeLinecap="butt" transform="rotate(-90 50 50)" />;
        })}
        <text x={50} y={48} textAnchor="middle" fill="#f0e8e0" fontSize={14} fontWeight={900}>{data.length}</text>
        <text x={50} y={60} textAnchor="middle" fill="#6b7280" fontSize={7}>formas</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-gray-400">{d.label}</span>
            <span className="font-bold text-white ml-auto">{BRL(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Relatorios() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [period, setPeriod] = useState('all');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const r = await fetch(`/api/reports?${params}`).then((x) => x.json());
    setData(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setQuick = (p: string) => {
    const now = new Date();
    const d = new Date();
    if (p === 'today') { d.setHours(0, 0, 0, 0); }
    else if (p === '7d') { d.setDate(now.getDate() - 7); }
    else if (p === '30d') { d.setDate(now.getDate() - 30); }
    else if (p === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); }
    else { setFrom(''); setTo(''); setPeriod(p); setTimeout(load, 50); return; }
    setFrom(d.toISOString().slice(0, 10));
    setTo(now.toISOString().slice(0, 10));
    setPeriod(p);
  };

  useEffect(() => { if (period !== 'all') load(); }, [from, to]);

  const paymentData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byPayment).map(([k, v]) => ({ label: PAYMENT_LABELS[k] || k, value: v, color: PAYMENT_COLORS[k] || '#6b7280' }));
  }, [data]);

  const typeData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byType).map(([k, v]) => ({ label: TYPE_LABELS[k] || k, value: v.total, color: TYPE_COLORS[k] || '#6b7280' }));
  }, [data]);

  const hourlyMax = useMemo(() => {
    if (!data) return 0;
    return Math.max(...Object.values(data.byHour).map(Number), 1);
  }, [data]);

  const csvUrl = `/api/reports?format=csv${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`;

  if (loading || !data) return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}><BarChart3 size={18} className="text-white" /></div>
        <div><h1 className="text-lg font-black text-white">Relatórios</h1><p className="text-[10px] text-gray-500">Carregando...</p></div>
      </div>
      <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}</div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <BarChart3 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Relatórios</h1>
            <p className="text-[10px] text-gray-500">Análise de vendas e desempenho</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={csvUrl} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            <Download size={12} /> CSV
          </a>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
            <Download size={12} /> PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-3 mb-5 flex flex-wrap items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Filter size={14} className="text-gray-500" />
        <div className="flex gap-1">
          {[
            { label: 'Hoje', p: 'today' }, { label: '7 dias', p: '7d' }, { label: '30 dias', p: '30d' },
            { label: 'Mês', p: 'month' }, { label: 'Tudo', p: 'all' },
          ].map(({ label, p }) => (
            <button key={p} onClick={() => setQuick(p)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={{ background: period === p ? 'rgba(225,29,72,0.15)' : 'transparent', color: period === p ? '#e11d48' : '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" className="input py-1 text-[11px]" value={from} onChange={(e) => { setFrom(e.target.value); setPeriod('custom'); }} />
          <span className="text-gray-600 text-[10px]">até</span>
          <input type="date" className="input py-1 text-[11px]" value={to} onChange={(e) => { setTo(e.target.value); setPeriod('custom'); }} />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Faturamento', value: BRL(data.summary.revenue), icon: '💰', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
          { label: 'Pedidos Ativos', value: data.summary.activeOrders, icon: '🛒', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
          { label: 'Cancelados', value: data.summary.cancelledOrders, icon: '❌', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
          { label: 'Ticket Médio', value: BRL(data.summary.avgTicket), icon: '📊', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
        ].map((s, i) => (
          <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg, border: `1px solid ${s.color}15`, animation: `slideUp 0.3s ease ${i * 50}ms both` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px]">{s.icon}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: s.color + '99' }}>{s.label}</span>
            </div>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Daily Revenue */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Vendas por Dia</p>
          {data.dailyData.length > 0 ? (
            <BarChartSVG data={data.dailyData.slice(-14).map(([day, d]) => ({ label: day.slice(5), value: d.total }))} maxVal={Math.max(...data.dailyData.map(([, d]) => d.total), 1)} />
          ) : <p className="text-[11px] text-gray-600 text-center py-8">Sem dados no período</p>}
        </div>

        {/* Payment Methods */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Formas de Pagamento</p>
          <DonutSVG data={paymentData} />
        </div>
      </div>

      {/* Peak Hours */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Horários de Pico (Faturamento)</p>
        <BarChartSVG
          data={Array.from({ length: 24 }, (_, i) => ({
            label: `${i}h`,
            value: Math.round(data.byHour[i] || 0),
            color: (data.byHour[i] || 0) >= hourlyMax * 0.7 ? '#e11d48' : (data.byHour[i] || 0) >= hourlyMax * 0.4 ? '#f59e0b' : '#3b82f6',
          }))}
          maxVal={hourlyMax}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Top Products */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Top 10 Produtos</p>
          <div className="space-y-2">
            {data.topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-600 w-4">{i + 1}º</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-white truncate">{p.name}</p>
                  <div className="h-1 rounded-full mt-1" style={{ background: 'rgba(255,255,255,0.06)', width: '100%' }}>
                    <div className="h-full rounded-full" style={{ width: `${data.topProducts[0] ? (p.total / data.topProducts[0].total) * 100 : 0}%`, background: '#e11d48' }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold text-white">{p.qty}x</p>
                  <p className="text-[9px] text-gray-600">{BRL(p.total)}</p>
                </div>
              </div>
            ))}
            {data.topProducts.length === 0 && <p className="text-[11px] text-gray-600 text-center py-4">Sem dados</p>}
          </div>
        </div>

        {/* By Type */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Por Tipo de Pedido</p>
          <div className="space-y-3">
            {Object.entries(data.byType).map(([type, d]) => (
              <div key={type} className="rounded-lg p-3" style={{ background: `${TYPE_COLORS[type] || '#6b7280'}10` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold" style={{ color: TYPE_COLORS[type] || '#9ca3af' }}>{TYPE_LABELS[type] || type}</span>
                  <span className="text-[11px] font-black text-white">{BRL(d.total)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{d.count} pedido(s)</span>
                  <span className="text-[10px] text-gray-500">{BRL(d.total / d.count)}/pedido</span>
                </div>
              </div>
            ))}
            {Object.keys(data.byType).length === 0 && <p className="text-[11px] text-gray-600 text-center py-4">Sem dados</p>}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="px-4 pt-3 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Últimos Pedidos ({data.orders.length})</p>
        </div>
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {data.orders.slice(0, 50).map((o) => (
            <div key={o.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] font-black text-gray-400 w-10">#{o.number}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: `${TYPE_COLORS[o.type] || '#6b7280'}15`, color: TYPE_COLORS[o.type] || '#9ca3af' }}>
                  {TYPE_LABELS[o.type] || o.type}
                </span>
                <span className="text-[10px] text-gray-300 truncate">{o.customerName || '—'}</span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                  {PAYMENT_LABELS[o.payment] || o.payment?.split(',')[0]?.split(':')[0] || '—'}
                </span>
                <span className="text-[10px] text-gray-600">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</span>
                <span className="text-xs font-black text-white">{BRL(o.total)}</span>
                {o.status === 'cancelado' && <span className="text-[9px] text-red-500 font-bold">CANCELADO</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
