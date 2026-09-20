'use client';
import { useEffect, useState, useMemo } from 'react';
import { Users, Phone, MapPin, TrendingUp, Clock, ChevronDown, ChevronUp, X, Heart, Calendar } from 'lucide-react';
import { BRL } from '@/lib/utils';

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  vip: { label: 'VIP', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '👑' },
  regular: { label: 'Regular', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: '⭐' },
  recorrente: { label: 'Recorrente', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: '🔄' },
  novo: { label: 'Novo', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: '🆕' },
};

const PAYMENT_LABELS: Record<string, string> = { pix: 'PIX', dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito' };
const TYPE_LABELS: Record<string, string> = { entrega: 'Entrega', mesa: 'Mesa', retirada: 'Retirada', balcão: 'Balcão', local: 'Local' };

export default function Clientes() {
  const [raw, setRaw] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'orders' | 'last' | 'ticket'>('last');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tierMenu, setTierMenu] = useState<string | null>(null);

  const load = async (query = '') => {
    const data = await fetch(`/api/customers?q=${encodeURIComponent(query)}`).then((r) => r.json());
    setRaw(data.customers || []);
    setStats(data.stats || null);
  };

  const setTier = async (id: string, tier: string) => {
    await fetch('/api/customers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tier }) });
    setTierMenu(null);
    load(searchInput);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const close = () => setTierMenu(null);
    if (tierMenu) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [tierMenu]);

  const handleSearch = () => load(searchInput);

  const sorted = useMemo(() => {
    let list = [...raw];
    if (tierFilter !== 'all') list = list.filter((c) => c.tier === tierFilter);
    list.sort((a, b) => {
      let va: any, vb: any;
      switch (sortBy) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'total': va = a.totalSpent; vb = b.totalSpent; break;
        case 'orders': va = a.orderCount; vb = b.orderCount; break;
        case 'last': va = a.lastOrder ? new Date(a.lastOrder).getTime() : 0; vb = b.lastOrder ? new Date(b.lastOrder).getTime() : 0; break;
        case 'ticket': va = a.ticketMedio; vb = b.ticketMedio; break;
        default: va = 0; vb = 0;
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return list;
  }, [raw, sortBy, sortDir, tierFilter]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const getInitials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const formatPhone = (p: string) => {
    const d = p?.replace(/\D/g, '') || '';
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return p || '—';
  };

  const getWhatsAppUrl = (phone: string) => {
    const d = phone?.replace(/\D/g, '') || '';
    if (!d) return null;
    const full = d.startsWith('55') ? d : `55${d}`;
    return `https://wa.me/${full}`;
  };

  const getFullAddress = (c: any) => {
    const parts = [c.street, c.number, c.complement, c.district].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  };

  const tierColors: Record<string, string> = { vip: '#f59e0b', regular: '#22c55e', recorrente: '#3b82f6', novo: '#6b7280' };
  const avatarColors = ['#e11d48', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Clientes</h1>
            <p className="text-[10px] text-gray-500">CRM completo do restaurante</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Clientes', value: stats.totalClients, icon: '👥', color: '#e11d48' },
            { label: 'Faturamento', value: BRL(stats.totalRevenue), icon: '💰', color: '#22c55e' },
            { label: 'Ticket Médio', value: BRL(stats.avgTicket), icon: '📊', color: '#f59e0b' },
            { label: 'Clientes VIP', value: stats.vipCount, icon: '👑', color: '#8b5cf6' },
          ].map((s, i) => (
            <div key={s.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: `slideUp 0.4s ease ${i * 60}ms both` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs">{s.icon}</span>
                <span className="text-[10px] font-medium text-gray-500 uppercase">{s.label}</span>
              </div>
              <p className="text-base font-black text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <input
              className="input w-full pl-9"
              placeholder="Buscar por nome ou telefone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <button onClick={handleSearch} className="px-4 py-2 rounded-xl text-xs font-bold text-white pdv-btn-hover" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            Buscar
          </button>
          {searchInput && (
            <button onClick={() => { setSearchInput(''); load(); }} className="px-3 py-2 rounded-xl text-xs font-medium text-gray-400 pdv-btn-hover" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tier Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
        {[{ key: 'all', label: 'Todos', count: raw.length }, ...Object.entries(TIER_CONFIG).map(([k, v]) => ({ key: k, label: v.label, count: raw.filter((c) => c.tier === k).length }))].map((t) => (
          <button key={t.key} onClick={() => setTierFilter(t.key)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all pdv-btn-hover"
            style={tierFilter === t.key
              ? { background: t.key === 'all' ? 'rgba(225,29,72,0.15)' : (TIER_CONFIG[t.key]?.bg || 'rgba(255,255,255,0.06)'), color: t.key === 'all' ? '#e11d48' : (TIER_CONFIG[t.key]?.color || '#fff'), border: `1px solid ${t.key === 'all' ? 'rgba(225,29,72,0.3)' : (TIER_CONFIG[t.key]?.color || '#666') + '33'}` }
              : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid transparent' }
            }>
            {TIER_CONFIG[t.key]?.icon && `${TIER_CONFIG[t.key].icon} `}{t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Sort Bar */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {([['name', 'Nome'], ['total', 'Total'], ['orders', 'Pedidos'], ['ticket', 'Ticket'], ['last', 'Último']] as const).map(([key, label]) => (
          <button key={key} onClick={() => toggleSort(key)}
            className="px-3 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all"
            style={sortBy === key
              ? { background: 'rgba(225,29,72,0.12)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.2)' }
              : { background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid transparent' }
            }>
            {label} {sortBy === key && (sortDir === 'desc' ? '↓' : '↑')}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-[10px] text-gray-600 mb-3">{sorted.length} cliente(s) encontrado(s)</p>

      {/* Client Cards */}
      <div className="space-y-2">
        {sorted.map((c, i) => {
          const isExpanded = expanded === c.id;
          const tier = TIER_CONFIG[c.tier] || TIER_CONFIG.novo;
          const color = avatarColors[i % avatarColors.length];
          return (
            <div key={c.id} className="rounded-xl overflow-hidden transition-all duration-300"
              style={{ background: isExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isExpanded ? 'rgba(225,29,72,0.2)' : 'rgba(255,255,255,0.06)'}`, animation: `slideUp 0.3s ease ${Math.min(i * 30, 300)}ms both` }}>
              {/* Main Row */}
              <div className="flex items-center gap-3 p-3 cursor-pointer pdv-hover" onClick={() => setExpanded(isExpanded ? null : c.id)}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}>
                  {getInitials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{c.name}</span>
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setTierMenu(tierMenu === c.id ? null : c.id); }}
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-bold cursor-pointer transition-all hover:scale-105"
                        style={{ background: tier.bg, color: tier.color }}>
                        {tier.icon} {tier.label}
                      </button>
                      {tierMenu === c.id && (
                        <div className="absolute top-full left-0 mt-1 z-50 rounded-xl py-1 min-w-[120px]" style={{ background: '#1e1828', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                          {Object.entries(TIER_CONFIG).map(([k, v]) => (
                            <button key={k} onClick={(e) => { e.stopPropagation(); setTier(c.id, k); }}
                              className="w-full px-3 py-1.5 text-[11px] font-medium text-left flex items-center gap-2 transition-colors hover:bg-white/5"
                              style={{ color: c.tier === k ? v.color : '#9ca3af' }}>
                              <span>{v.icon}</span>
                              <span>{v.label}</span>
                              {c.tier === k && <span className="ml-auto text-[9px]">●</span>}
                            </button>
                          ))}
                          {c.tier && (
                            <button onClick={(e) => { e.stopPropagation(); setTier(c.id, ''); }}
                              className="w-full px-3 py-1.5 text-[11px] font-medium text-left flex items-center gap-2 transition-colors hover:bg-white/5"
                              style={{ color: '#ef4444', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 2, paddingTop: 6 }}>
                              <span>✕</span><span>Limpar (auto)</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.phone && (
                      <a href={getWhatsAppUrl(c.phone) || '#'} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] flex items-center gap-1 transition-colors"
                        style={{ color: '#25d366' }}
                        onClick={(e) => e.stopPropagation()}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        {formatPhone(c.phone)}
                      </a>
                    )}
                    {getFullAddress(c) && <span className="text-[10px] text-gray-600 flex items-center gap-1 truncate"><MapPin size={9} />{getFullAddress(c)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-white">{BRL(c.totalSpent)}</p>
                  <p className="text-[10px] text-gray-500">{c.orderCount} pedido(s)</p>
                </div>
                <div className="text-gray-600 shrink-0">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3">
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-[9px] text-gray-500 uppercase mb-0.5">Total Gasto</p>
                      <p className="text-xs font-bold text-green-400">{BRL(c.totalSpent)}</p>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-[9px] text-gray-500 uppercase mb-0.5">Ticket Médio</p>
                      <p className="text-xs font-bold text-amber-400">{BRL(c.ticketMedio)}</p>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-[9px] text-gray-500 uppercase mb-0.5">Desde</p>
                      <p className="text-xs font-bold text-blue-400">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}</p>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-[9px] text-gray-500 uppercase mb-0.5">Último Pedido</p>
                      <p className="text-xs font-bold text-purple-400">{c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('pt-BR') : '—'}</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="rounded-lg p-2 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <MapPin size={12} className="text-gray-500 shrink-0" />
                    <span className="text-[11px] text-gray-400">{getFullAddress(c) || 'Endereço não informado'}</span>
                  </div>

                  {/* Frequency */}
                  {c.avgDaysBetween && (
                    <div className="rounded-lg p-2 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <Calendar size={12} className="text-gray-500 shrink-0" />
                      <span className="text-[11px] text-gray-400">A cada {c.avgDaysBetween} dia(s) em média {c.daysSinceLast !== null && c.daysSinceLast > c.avgDaysBetween * 1.5 ? '· ⚠️ Ausente' : '· ✅ Ativo'}</span>
                    </div>
                  )}

                  {/* Favorite Products */}
                  {c.favProducts?.length > 0 && (
                    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-[9px] text-gray-500 uppercase mb-1.5 flex items-center gap-1"><Heart size={10} /> Favoritos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.favProducts.map((fp: any) => (
                          <span key={fp.name} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
                            {fp.name} ({fp.qty}x)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Last 5 Orders */}
                  {c.last5Orders?.length > 0 && (
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase mb-1.5 flex items-center gap-1"><Clock size={10} /> Últimos pedidos</p>
                      <div className="space-y-1">
                        {c.last5Orders.map((o: any) => (
                          <div key={o.number} className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-400">#{o.number}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                                {TYPE_LABELS[o.type] || o.type}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                                {PAYMENT_LABELS[o.payment] || o.payment?.split(',')[0]?.split(':')[0] || '—'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-white">{BRL(o.total)}</span>
                              <span className="text-[9px] text-gray-600 ml-2">{new Date(o.date).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center py-12">
            <Users size={32} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm text-gray-500">Nenhum cliente encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
