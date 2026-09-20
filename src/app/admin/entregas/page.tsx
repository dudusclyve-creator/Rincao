'use client';
import { useEffect, useState, useCallback } from 'react';
import { BRL } from '@/lib/utils';
import {
  MapPin, Phone, Plus, Trash2, X, Check, Pencil,
  ChevronDown, ChevronUp, Circle, CircleDot, Ban, Zap,
  Truck, BarChart3, Users, LayoutGrid, Banknote, CreditCard, Smartphone, CircleCheck
} from 'lucide-react';

const MotorcycleIcon = ({ size = 14, className = '', style }: { size?: number; className?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="5" cy="18" r="3" />
    <circle cx="19" cy="18" r="3" />
    <path d="M12 18V5l4-2" />
    <path d="M5 18h4" />
    <path d="M12 5l3 3" />
    <path d="M15 8h4l-3 5" />
  </svg>
);

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  disponivel: { label: 'Disponível', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  em_entrega: { label: 'Em entrega', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  offline: { label: 'Offline', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const PAYMENT_INFO: Record<string, { label: string; icon: any; color: string; carries: string }> = {
  pix: { label: 'PIX', icon: Smartphone, color: '#22c55e', carries: '📱 App PIX' },
  dinheiro: { label: 'Dinheiro', icon: Banknote, color: '#f59e0b', carries: '💵 Dinheiro' },
  debito: { label: 'Débito', icon: CreditCard, color: '#3b82f6', carries: '💳 Maquininha' },
  credito: { label: 'Crédito', icon: CreditCard, color: '#8b5cf6', carries: '💳 Maquininha' },
};

function getPaymentDisplay(payment: string) {
  if (!payment) return PAYMENT_INFO.pix;
  if (payment.includes(',')) {
    const parts = payment.split(',');
    const methods = parts.map(p => p.split(':')[0]);
    const hasDinheiro = methods.includes('dinheiro');
    const hasCard = methods.includes('debito') || methods.includes('credito');
    const hasPix = methods.includes('pix');
    const labels: string[] = [];
    const carries: string[] = [];
    if (hasDinheiro) { labels.push('Dinheiro'); carries.push('💵 Dinheiro'); }
    if (hasCard) { labels.push('Maquininha'); carries.push('💳 Maquininha'); }
    if (hasPix) { labels.push('PIX'); carries.push('📱 PIX'); }
    return { label: labels.join(' + ') || payment, icon: hasCard ? CreditCard : Banknote, color: '#f59e0b', carries: carries.join(' + ') };
  }
  return PAYMENT_INFO[payment] || PAYMENT_INFO.pix;
}

type Tab = 'pedidos' | 'entregadores' | 'bairros' | 'relatorio';

export default function Entregas() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('pedidos');
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [editingDriver, setEditingDriver] = useState<string | null>(null);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState<number | ''>('');
  const [newAreaCity, setNewAreaCity] = useState('Santana do Livramento');
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editAreaName, setEditAreaName] = useState('');
  const [editAreaFee, setEditAreaFee] = useState(0);
  const [editAreaCity, setEditAreaCity] = useState('');

  const load = useCallback(async () => {
    const [d, o, a] = await Promise.all([
      fetch('/api/drivers').then((r) => r.json()),
      fetch('/api/orders?limit=500').then((r) => r.json()),
      fetch('/api/delivery-areas').then((r) => r.json()),
    ]);
    setDrivers(d);
    setOrders(o);
    setAreas(a);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const delivery = orders.filter((o: any) => o.type === 'entrega' && !['concluido', 'cancelado'].includes(o.status));
  const reportOrders = orders.filter((o: any) => o.type === 'entrega' && o.driverId);

  const addDriver = async () => {
    if (!newDriverName.trim()) return;
    await fetch('/api/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newDriverName.trim(), phone: newDriverPhone.trim() }) });
    setNewDriverName(''); setNewDriverPhone('');
    load();
  };

  const updateDriver = async (id: string) => {
    await fetch('/api/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: editDriverName, phone: editDriverPhone }) });
    setEditingDriver(null);
    load();
  };

  const deleteDriver = async (id: string) => {
    if (!confirm('Excluir entregador?')) return;
    await fetch(`/api/drivers?id=${id}`, { method: 'DELETE' });
    load();
  };

  const setStatus = async (id: string, status: string) => {
    await fetch('/api/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  };

  const addArea = async () => {
    if (!newAreaName.trim()) return;
    await fetch('/api/delivery-areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', city: newAreaCity, name: newAreaName.trim(), fee: Number(newAreaFee || 0) }) });
    setNewAreaName(''); setNewAreaFee('');
    load();
  };

  const updateArea = async (id: string) => {
    await fetch('/api/delivery-areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id, city: editAreaCity, name: editAreaName, fee: editAreaFee }) });
    setEditingArea(null);
    load();
  };

  const deleteArea = async (id: string) => {
    if (!confirm('Excluir bairro?')) return;
    await fetch('/api/delivery-areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
    load();
  };

  const toggleAreaActive = async (id: string, active: boolean) => {
    await fetch('/api/delivery-areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id, active }) });
    load();
  };

  const tabs: { id: Tab; label: string; icon: any; count: number; color: string }[] = [
    { id: 'pedidos', label: 'Pedidos Ativos', icon: Zap, count: delivery.length, color: '#f59e0b' },
    { id: 'entregadores', label: 'Entregadores', icon: Users, count: drivers.length, color: '#22c55e' },
    { id: 'bairros', label: 'Bairros', icon: LayoutGrid, count: areas.length, color: '#3b82f6' },
    { id: 'relatorio', label: 'Relatório', icon: BarChart3, count: reportOrders.length, color: '#a855f7' },
  ];

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
          <MotorcycleIcon size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white">Entregas</h1>
          <p className="text-[10px] text-gray-500">{delivery.length} pedido(s) ativo(s) · {drivers.length} entregador(es) · {areas.length} bairro(s)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold transition-all duration-200"
              style={active
                ? { background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}30` }
                : { color: '#6b7280', border: '1px solid transparent' }}>
              <Icon size={13} />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: active ? `${t.color}25` : 'rgba(255,255,255,0.06)' }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'pedidos' && (
        delivery.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-3">
            {delivery.map((o: any) => {
              const pay = getPaymentDisplay(o.payment);
              const PayIcon = pay.icon;
              const driver = drivers.find((d: any) => d.id === o.driverId);
              const isEntrega = o.status === 'entrega';
              return (
                <div key={o.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">#{o.number}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{o.status}</span>
                    </div>
                    <span className="text-sm font-black text-white">{BRL(o.total)}</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    <p className="text-xs font-bold text-white">{o.customerName}</p>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400">
                      <MapPin size={10} className="shrink-0" /> <span className="truncate">{o.addressText || 'Sem endereço'}</span>
                    </div>
                    {o.customerPhone && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Phone size={10} /> {o.customerPhone}
                      </div>
                    )}
                  </div>

                  {/* Payment & Driver Info */}
                  {isEntrega && driver && (
                    <div className="rounded-lg p-2.5 mb-3" style={{ background: `${pay.color}10`, border: `1px solid ${pay.color}25` }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <MotorcycleIcon size={12} style={{ color: '#f59e0b' }} />
                        <span className="text-[11px] font-bold text-white">{driver.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>na rua</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PayIcon size={12} style={{ color: pay.color }} />
                        <span className="text-[11px] font-bold" style={{ color: pay.color }}>{pay.carries}</span>
                      </div>
                    </div>
                  )}

                  {!isEntrega && (
                    <select className="input text-xs w-full"
                      value={o.driverId || ''}
                      onChange={async (e) => {
                        await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, status: 'entrega', driverId: e.target.value || null }) });
                        load();
                      }}>
                      <option value="">Atribuir entregador</option>
                      {drivers.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name} ({STATUS_MAP[d.status]?.label || d.status})</option>
                      ))}
                    </select>
                  )}

                  {/* Concluir Button */}
                  {isEntrega && (
                    <button onClick={async () => {
                      await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, status: 'concluido' }) });
                      load();
                    }} className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold text-white pdv-btn-hover" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                      <span className="flex items-center justify-center gap-1.5"><CircleCheck size={13} /> Confirmar entrega</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <Zap size={24} className="text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Nenhum pedido ativo</p>
          </div>
        )
      )}

      {tab === 'entregadores' && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Add Driver */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Novo entregador</p>
            <div className="flex gap-2">
              <input className="input flex-1 text-xs" placeholder="Nome" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDriver()} />
              <input className="input flex-1 text-xs" placeholder="Telefone" value={newDriverPhone} onChange={(e) => setNewDriverPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDriver()} />
              <button onClick={addDriver} className="px-3 py-2 rounded-xl text-white shrink-0 pdv-btn-hover" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Driver List */}
          <div className="space-y-2">
            {drivers.map((d: any) => {
              const st = STATUS_MAP[d.status] || STATUS_MAP.offline;
              return (
                <div key={d.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {editingDriver === d.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input className="input flex-1 text-xs" placeholder="Nome" value={editDriverName} onChange={(e) => setEditDriverName(e.target.value)} />
                        <input className="input flex-1 text-xs" placeholder="Telefone" value={editDriverPhone} onChange={(e) => setEditDriverPhone(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateDriver(d.id)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg pdv-btn-hover" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }}><Check size={12} /></button>
                        <button onClick={() => setEditingDriver(null)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg pdv-btn-hover" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}><X size={12} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: st.bg }}>
                            <MotorcycleIcon size={14} style={{ color: st.color }} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{d.name}</p>
                            {d.phone && <p className="text-[10px] text-gray-500">{d.phone}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button title="Editar entregador" onClick={() => { setEditingDriver(d.id); setEditDriverName(d.name); setEditDriverPhone(d.phone || ''); }} className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-blue-400"><Pencil size={12} /></button>
                          <button title="Excluir entregador" onClick={() => deleteDriver(d.id)} className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {Object.entries(STATUS_MAP).map(([key, s]) => (
                          <button key={key} title={`Definir como ${s.label}`} onClick={() => setStatus(d.id, key)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold pdv-btn-hover transition-all"
                            style={d.status === key
                              ? { background: s.bg, color: s.color, border: `1px solid ${s.color}40` }
                              : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {d.status === key ? <CircleDot size={8} /> : <Circle size={8} />}
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {drivers.length === 0 && (
              <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <Users size={24} className="text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Nenhum entregador cadastrado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'bairros' && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Add Area */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Novo bairro</p>
            <div className="flex gap-2 items-center">
              <select className="input text-xs w-44 shrink-0" value={newAreaCity} onChange={(e) => setNewAreaCity(e.target.value)}>
                <option value="Santana do Livramento">Santana do Livramento</option>
                <option value="Rivera">Rivera</option>
              </select>
              <input className="input flex-1 text-xs" placeholder="Bairro" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addArea()} />
              <div className="relative w-24 shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold z-10 pointer-events-none">R$</span>
                <input className="input text-xs w-full" style={{ paddingLeft: '26px' }} type="number" placeholder="Taxa" value={newAreaFee} onChange={(e) => setNewAreaFee(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <button onClick={addArea} className="px-3 py-2 rounded-xl text-white shrink-0 pdv-btn-hover" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Areas List grouped by city */}
          <div className="space-y-4">
            {(['Santana do Livramento', 'Rivera'] as const).map((city) => {
              const cityAreas = areas.filter((a: any) => (a.city || 'Santana do Livramento') === city);
              if (cityAreas.length === 0) return null;
              return (
                <div key={city}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: city === 'Santana do Livramento' ? '#22c55e' : '#a855f7' }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: city === 'Santana do Livramento' ? '#22c55e' : '#a855f7' }}>{city}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>{cityAreas.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {cityAreas.map((a: any) => (
                      <div key={a.id} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', opacity: a.active === false ? 0.4 : 1 }}>
                        {editingArea === a.id ? (
                          <div className="space-y-2">
                            <select className="input text-xs w-full" value={editAreaCity} onChange={(e) => setEditAreaCity(e.target.value)}>
                              <option value="Santana do Livramento">Santana do Livramento</option>
                              <option value="Rivera">Rivera</option>
                            </select>
                            <div className="flex gap-2 items-center">
                              <input className="input flex-1 text-xs" placeholder="Bairro" value={editAreaName} onChange={(e) => setEditAreaName(e.target.value)} />
                              <div className="relative w-24 shrink-0">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold z-10 pointer-events-none">R$</span>
                                <input className="input text-xs w-full" style={{ paddingLeft: '26px' }} type="number" value={editAreaFee} onChange={(e) => setEditAreaFee(Number(e.target.value))} />
                              </div>
                              <button onClick={() => updateArea(a.id)} className="p-1.5 rounded-lg pdv-hover" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }}><Check size={12} /></button>
                              <button onClick={() => setEditingArea(null)} className="p-1.5 rounded-lg pdv-hover" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}><X size={12} /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin size={12} className="text-gray-500" />
                              <span className="text-xs font-bold text-white">{a.name}</span>
                              <span className="text-[10px] font-bold" style={{ color: '#22c55e' }}>+{BRL(a.fee)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button title={a.active !== false ? 'Desativar' : 'Ativar'} onClick={() => toggleAreaActive(a.id, !(a.active !== false))} className="p-1.5 rounded-lg pdv-hover" style={{ color: a.active !== false ? '#22c55e' : '#6b7280' }}>
                                {a.active !== false ? <CircleDot size={12} /> : <Ban size={12} />}
                              </button>
                              <button title="Editar" onClick={() => { setEditingArea(a.id); setEditAreaName(a.name); setEditAreaFee(a.fee); setEditAreaCity(a.city || 'Santana do Livramento'); }} className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-blue-400"><Pencil size={12} /></button>
                              <button title="Excluir" onClick={() => deleteArea(a.id)} className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {areas.length === 0 && (
              <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <LayoutGrid size={24} className="text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Nenhum bairro configurado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'relatorio' && (
        <div className="space-y-3">
          {drivers.map((d: any) => {
            const completedOrders = reportOrders.filter((o: any) => o.driverId === d.id && o.status === 'concluido');
            const activeOrders = reportOrders.filter((o: any) => o.driverId === d.id && !['concluido', 'cancelado'].includes(o.status));
            const totalFees = completedOrders.reduce((s: number, o: any) => s + (o.deliveryFee || 0), 0);
            const totalValue = completedOrders.reduce((s: number, o: any) => s + o.total, 0);
            const st = STATUS_MAP[d.status] || STATUS_MAP.offline;

            return (
              <div key={d.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: st.bg }}>
                      <MotorcycleIcon size={14} style={{ color: st.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{d.name}</p>
                      <p className="text-[10px] text-gray-500">{d.phone || 'Sem telefone'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 uppercase">Corridas</p>
                      <p className="text-sm font-black text-white">{completedOrders.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 uppercase">Taxas</p>
                      <p className="text-sm font-black" style={{ color: '#22c55e' }}>{BRL(totalFees)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 uppercase">Total</p>
                      <p className="text-sm font-black text-white">{BRL(totalValue)}</p>
                    </div>
                  </div>
                </div>

                {activeOrders.length > 0 && (
                  <div className="mb-2 space-y-0.5">
                    {activeOrders.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-white">#{o.number}</span>
                          <span className="text-[10px] text-gray-400">{o.customerName}</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-400">{o.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {completedOrders.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto space-y-0.5">
                    {completedOrders.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-white">#{o.number}</span>
                          <span className="text-[10px] text-gray-400">{o.customerName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{o.addressText?.split(',')[0] || ''}</span>
                          <span className="text-[10px] font-bold" style={{ color: '#22c55e' }}>+{BRL(o.deliveryFee || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeOrders.length === 0 && (
                  <p className="text-[10px] text-gray-600 text-center py-2">Nenhuma entrega registrada</p>
                )}
              </div>
            );
          })}

          {/* Total Geral */}
          <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(225,29,72,0.08))', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Total a pagar motoboys</p>
                <p className="text-[10px] text-gray-500">{drivers.length} entregador(es) · {reportOrders.filter((o: any) => o.status === 'concluido').length} entrega(s) concluída(s)</p>
              </div>
              <p className="text-lg font-black" style={{ color: '#f59e0b' }}>
                {BRL(reportOrders.filter((o: any) => o.status === 'concluido').reduce((s: number, o: any) => s + (o.deliveryFee || 0), 0))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
