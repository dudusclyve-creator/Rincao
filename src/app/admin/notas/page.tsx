'use client';
import { useEffect, useMemo, useState } from 'react';
import { FileText, Copy, Check, ExternalLink, CalendarDays } from 'lucide-react';
import { BRL } from '@/lib/utils';

const STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  issued: { label: 'Emitida', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: '✅' },
  cancelled: { label: 'Cancelada', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '✖️' },
  error: { label: 'Erro', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⚠️' },
  queued: { label: 'Na fila', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: '🕐' },
  processing: { label: 'Processando', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: '⏳' },
};

const TIPO: Record<string, { label: string; color: string }> = {
  entrega: { label: 'ENTREGA', color: '#f59e0b' },
  retirada: { label: 'RETIRADA', color: '#fb923c' },
  local: { label: 'LOCAL', color: '#93c5fd' },
  mesa: { label: 'MESA', color: '#d8b4fe' },
  balcao: { label: 'BALCÃO', color: '#fde68a' },
};

const dk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function NotasPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [filter, setFilter] = useState<'all' | 'issued' | 'cancelled' | 'error'>('all');

  const load = async () => {
    try {
      const d = await fetch('/api/orders?limit=500').then((r) => r.json());
      setOrders(Array.isArray(d) ? d : []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const notas = useMemo(
    () => orders.filter((o) => o.nfeStatus && (filter === 'all' || o.nfeStatus === filter)),
    [orders, filter]
  );

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const o of notas) {
      const key = dk(new Date(o.nfeIssuedAt || o.createdAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    const todayKey = dk(new Date());
    const yesterdayKey = dk(new Date(Date.now() - 86400000));
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, rows]) => {
        rows.sort((a, b) => new Date(b.nfeIssuedAt || b.createdAt).getTime() - new Date(a.nfeIssuedAt || a.createdAt).getTime());
        const dt = new Date(key + 'T12:00:00');
        const label = key === todayKey ? 'Hoje' : key === yesterdayKey ? 'Ontem' : dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
        return {
          key, label, rows,
          emitidas: rows.filter((r) => r.nfeStatus === 'issued').length,
          canceladas: rows.filter((r) => r.nfeStatus === 'cancelled').length,
          total: rows.reduce((s, o) => s + Number(o.total || 0), 0),
        };
      });
  }, [notas]);

  const allNotas = useMemo(() => orders.filter((o) => o.nfeStatus), [orders]);
  const stats = {
    emitidas: allNotas.filter((o) => o.nfeStatus === 'issued').length,
    canceladas: allNotas.filter((o) => o.nfeStatus === 'cancelled').length,
    erros: allNotas.filter((o) => o.nfeStatus === 'error').length,
    valor: allNotas.filter((o) => o.nfeStatus === 'issued').reduce((s, o) => s + Number(o.total || 0), 0),
  };

  const copyKey = (k: string) => {
    navigator.clipboard?.writeText(k);
    setCopied(k);
    setTimeout(() => setCopied(''), 1500);
  };
  const openXml = (o: any) => {
    if (!o.nfeXml) return;
    const url = URL.createObjectURL(new Blob([o.nfeXml], { type: 'application/xml' }));
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Notas fiscais</h1>
            <p className="text-[10px] text-gray-500">Emissões de NFC-e organizadas por data</p>
          </div>
        </div>
        <button onClick={load} className="px-3 py-2 rounded-xl text-[11px] font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#c0b8c8' }}>🔄 Atualizar</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Emitidas', value: stats.emitidas, icon: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
          { label: 'Canceladas', value: stats.canceladas, icon: '✖️', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
          { label: 'Com Erro', value: stats.erros, icon: '⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
          { label: 'Valor Emitido', value: BRL(stats.valor), icon: '💰', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg, border: `1px solid ${s.color}15` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px]">{s.icon}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: s.color + '99' }}>{s.label}</span>
            </div>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([['all', 'Todas'], ['issued', 'Emitidas'], ['cancelled', 'Canceladas'], ['error', 'Erros']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={filter === k ? { background: 'rgba(225,29,72,0.18)', color: '#f0e8e0', border: '1px solid rgba(225,29,72,0.35)' } : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
            {l}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500 py-8 text-center">Carregando emissões…</p>}

      {!loading && groups.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <CalendarDays size={28} className="mx-auto mb-2" style={{ color: '#4b5563' }} />
          <p className="text-sm font-bold text-gray-400">Nenhuma nota por aqui ainda</p>
          <p className="text-[11px] text-gray-600 mt-1">As notas são emitidas na tela de Pedidos, no botão da NFC-e do pedido.</p>
        </div>
      )}

      {/* Grupos por data */}
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            {/* Cabeçalho do dia */}
            <div className="flex items-center gap-3 mb-2 px-1">
              <div className="flex items-center gap-2">
                <CalendarDays size={13} style={{ color: '#e11d48' }} />
                <span className="text-[13px] font-black capitalize" style={{ color: '#f0e8e0' }}>{g.label}</span>
                <span className="text-[10px] text-gray-600">({g.key.split('-').reverse().join('/')})</span>
              </div>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span className="text-[10px] font-bold" style={{ color: '#6b7280' }}>
                {g.rows.length} nota(s) · {g.emitidas} emitida(s){g.canceladas ? ` · ${g.canceladas} cancelada(s)` : ''} · {BRL(g.total)}
              </span>
            </div>

            {/* Notas do dia */}
            <div className="space-y-1.5">
              {g.rows.map((o: any) => {
                const st = STATUS[o.nfeStatus] || { label: o.nfeStatus, color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: '•' };
                const tp = TIPO[o.type] || { label: (o.type || '').toUpperCase(), color: '#9ca3af' };
                const when = new Date(o.nfeIssuedAt || o.createdAt);
                const key = o.nfeKey || '';
                return (
                  <div key={o.id} className="rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-[11px] font-mono font-bold w-11 shrink-0" style={{ color: '#8a7a6a' }}>
                      {when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[12px] font-black" style={{ color: '#f0e8e0' }}>#{o.number}</span>
                    {o.nfeNumber != null && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#c0b8c8' }}>NFC-e {String(o.nfeNumber).padStart(3, '0')}</span>
                    )}
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: tp.color + '1f', color: tp.color }}>{tp.label}</span>
                    <span className="text-[11px] truncate" style={{ color: '#8a7a6a', maxWidth: '160px' }}>{o.customerName || '—'}</span>
                    <span className="text-[12px] font-black ml-auto" style={{ color: '#f0e8e0' }}>{BRL(Number(o.total || 0))}</span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                    {key && (
                      <button onClick={() => copyKey(key)} title={key} className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: copied === key ? '#22c55e' : '#6b7280' }}>
                        {copied === key ? <><Check size={10} /> copiada</> : <><Copy size={10} /> {key.slice(0, 10)}…{key.slice(-6)}</>}
                      </button>
                    )}
                    {o.nfeXml && (
                      <button onClick={() => openXml(o)} className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }} title="Ver XML da nota">
                        <ExternalLink size={10} /> XML
                      </button>
                    )}
                    {o.nfeProtocol && (
                      <span className="text-[9px] font-mono" style={{ color: '#4b5563' }} title={`Protocolo: ${o.nfeProtocol}`}>prot {o.nfeProtocol.slice(-8)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
