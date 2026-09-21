'use client';
import { useEffect, useState } from 'react';
import { Tag, Plus, Trash2, Power, Percent, DollarSign, Truck, Package, X, Check } from 'lucide-react';

const KIND_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  percent: { label: 'Percentual', icon: Percent, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  fixed: { label: 'Valor Fixo', icon: DollarSign, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  frete_gratis: { label: 'Frete Grátis', icon: Truck, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
};

export default function Promocoes() {
  const [promos, setPromos] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', kind: 'percent', value: 0, productId: '', startAt: '', endAt: '' });

  const load = async () => {
    try {
      const [p, pr] = await Promise.all([
        fetch('/api/promotions').then(r => r.ok ? r.json() : []),
        fetch('/api/products').then(r => r.ok ? r.json() : []),
      ]);
      setPromos(Array.isArray(p) ? p : []);
      setProducts(Array.isArray(pr) ? pr : []);
    } catch { setPromos([]); setProducts([]); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim()) return;
    await fetch('/api/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm({ title: '', kind: 'percent', value: 0, productId: '', startAt: '', endAt: '' });
    setShowForm(false);
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await fetch('/api/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle', id, active }) });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir promoção?')) return;
    await fetch('/api/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
    load();
  };

  const now = new Date();

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <Tag size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Promoções</h1>
            <p className="text-[10px] text-gray-500">{promos.length} promoção(ões) · {promos.filter(p => p.active).length} ativa(s)</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200"
          style={{ background: showForm ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, #e11d48, #be123c)', color: showForm ? '#ef4444' : '#fff', boxShadow: showForm ? 'none' : '0 4px 16px rgba(225,29,72,0.3)' }}>
          {showForm ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Nova Promoção</>}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl p-4 mb-5 space-y-3" style={{ background: 'rgba(225,29,72,0.04)', border: '1px solid rgba(225,29,72,0.15)', animation: 'slideDown 0.3s ease' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Título</label>
              <input className="input w-full" placeholder="Ex: Happy Hour, Promoção de Verão..." value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Tipo</label>
              <div className="flex gap-1">
                {Object.entries(KIND_CONFIG).map(([k, v]) => (
                  <button key={k} onClick={() => setForm({ ...form, kind: k })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all"
                    style={{ background: form.kind === k ? v.bg : 'rgba(255,255,255,0.03)', color: form.kind === k ? v.color : '#6b7280', border: form.kind === k ? `1px solid ${v.color}30` : '1px solid transparent' }}>
                    <v.icon size={12} /> {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">
                {form.kind === 'percent' ? 'Percentual (%)' : form.kind === 'fixed' ? 'Valor (R$)' : 'Valor (R$)'}
              </label>
              <input className="input w-full" type="number" placeholder={form.kind === 'percent' ? '10' : '5.00'}
                value={form.value || ''} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            </div>
            {form.kind === 'produto' && (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Produto</label>
                <select className="input w-full" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  <option value="">Todos os produtos</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Início</label>
              <input className="input w-full" type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Fim (opcional)</label>
              <input className="input w-full" type="date" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={create} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }}>
              <Check size={14} /> Criar Promoção
            </button>
          </div>
        </div>
      )}

      {/* Promos List */}
      <div className="space-y-2">
        {promos.map((p, i) => {
          const kCfg = KIND_CONFIG[p.kind] || KIND_CONFIG.percent;
          const isExpired = p.endAt && new Date(p.endAt) < now;
          const isActive = p.active && !isExpired;
          const product = products.find((pr: any) => pr.id === p.productId);
          const Icon = kCfg.icon;

          return (
            <div key={p.id} className="rounded-xl p-4 transition-all duration-200"
              style={{
                background: isActive ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.03)',
                border: isActive ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(255,255,255,0.06)',
                animation: `slideUp 0.3s ease ${i * 30}ms both`,
              }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: kCfg.bg }}>
                  <Icon size={18} style={{ color: kCfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{p.title}</span>
                    {isExpired && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(107,114,128,0.15)', color: '#6b7280' }}>EXPIRADA</span>}
                    {!p.active && !isExpired && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>PAUSADA</span>}
                    {isActive && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>ATIVA</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] font-bold" style={{ color: kCfg.color }}>
                      {p.kind === 'percent' ? `${p.value}% OFF` : p.kind === 'fixed' ? `-R$ ${p.value.toFixed(2)}` : `Frete grátis`}
                    </span>
                    {product && <span className="text-[10px] text-gray-500">· {product.name}</span>}
                    {p.startAt && <span className="text-[10px] text-gray-600">· {new Date(p.startAt).toLocaleDateString('pt-BR')}</span>}
                    {p.endAt && <span className="text-[10px] text-gray-600">até {new Date(p.endAt).toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggle(p.id, !p.active)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{ background: isActive ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: isActive ? '#f59e0b' : '#22c55e' }}>
                    <Power size={14} />
                  </button>
                  <button onClick={() => remove(p.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{ background: 'rgba(239,68,68,0.06)', color: '#6b7280' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = '#6b7280'; }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {promos.length === 0 && (
          <div className="text-center py-16">
            <Tag size={36} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm text-gray-500">Nenhuma promoção criada</p>
            <p className="text-[11px] text-gray-600 mt-1">Crie promoções para atrair mais clientes</p>
          </div>
        )}
      </div>
    </div>
  );
}
