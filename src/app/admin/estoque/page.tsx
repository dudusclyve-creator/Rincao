'use client';
import { useEffect, useState } from 'react';
import { Package, Plus, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Search, Trash2, Edit3, Check, X, BarChart3 } from 'lucide-react';
import { BRL } from '@/lib/utils';

type Movement = { id: string; kind: string; qty: number; reason?: string; createdAt: string };

export default function Estoque() {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', unit: 'un', qty: 0, minQty: 0 });
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', unit: '', qty: 0, minQty: 0 });
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveQty, setMoveQty] = useState('');
  const [moveKind, setMoveKind] = useState<'entrada' | 'saida'>('entrada');
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => setList(await fetch('/api/inventory').then((r) => r.json()));
  useEffect(() => { load(); }, []);

  const filtered = list.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  const totalItems = list.length;
  const lowStock = list.filter((i) => i.qty <= i.minQty && i.minQty > 0).length;
  const totalUnits = list.reduce((s, i) => s + i.qty, 0);

  const unitColors: Record<string, string> = { kg: '#f59e0b', un: '#3b82f6', L: '#22c55e', l: '#22c55e', cx: '#a855f7', pct: '#ec4899' };

  const getUnitColor = (unit: string) => unitColors[unit?.toLowerCase?.()] || '#6b7280';

  const createItem = async () => {
    if (!f.name.trim()) return;
    await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...f }) });
    setF({ name: '', unit: 'un', qty: 0, minQty: 0 });
    setShowForm(false);
    load();
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, unit: item.unit, qty: item.qty, minQty: item.minQty });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: editingId, ...editForm }) });
    setEditingId(null);
    load();
  };

  const openMove = (id: string, kind: 'entrada' | 'saida') => {
    setMoveId(id);
    setMoveKind(kind);
    setMoveQty('');
  };

  const confirmMove = async () => {
    if (!moveId || !moveQty) return;
    await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', itemId: moveId, kind: moveKind, qty: Number(moveQty) }) });
    setMoveId(null);
    setMoveQty('');
    load();
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Excluir item do estoque?')) return;
    await fetch(`/api/inventory?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Estoque</h1>
            <p className="text-[10px] text-gray-500">{totalItems} item(s) cadastrado(s)</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200"
          style={{ background: showForm ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, #e11d48, #be123c)', color: showForm ? '#ef4444' : '#fff', boxShadow: showForm ? 'none' : '0 4px 16px rgba(225,29,72,0.3)' }}>
          {showForm ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Novo Item</>}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Itens', value: totalItems, icon: '📦', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
          { label: 'Estoque Baixo', value: lowStock, icon: '⚠️', color: lowStock > 0 ? '#ef4444' : '#22c55e', bg: lowStock > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)' },
          { label: 'Unidades Total', value: totalUnits, icon: '📊', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
        ].map((s, i) => (
          <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg, border: `1px solid ${s.color}15`, animation: `slideUp 0.4s ease ${i * 60}ms both` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px]">{s.icon}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: s.color + '99' }}>{s.label}</span>
            </div>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(225,29,72,0.04)', border: '1px solid rgba(225,29,72,0.15)', animation: 'slideDown 0.3s ease' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/60 mb-3">Novo Item</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input className="input" placeholder="Nome do item" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className="input" placeholder="Un (kg/un/L)" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
            <input className="input" type="number" placeholder="Quantidade" value={f.qty || ''} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
            <input className="input" type="number" placeholder="Mínimo" value={f.minQty || ''} onChange={(e) => setF({ ...f, minQty: Number(e.target.value) })} />
            <button onClick={createItem}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }}>
              <Check size={14} /> Cadastrar
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <input className="input w-full pl-9" placeholder="Buscar item no estoque..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>

      {/* Items Grid */}
      <div className="space-y-2">
        {filtered.map((item, i) => {
          const isEditing = editingId === item.id;
          const isLow = item.qty <= item.minQty && item.minQty > 0;
          const uColor = getUnitColor(item.unit);
          const pct = item.minQty > 0 ? Math.min(100, (item.qty / item.minQty) * 100) : 100;
          const isMoving = moveId === item.id;

          return (
            <div key={item.id} className="rounded-xl overflow-hidden transition-all duration-200"
              style={{
                background: isLow ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.03)',
                border: isLow ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
                animation: `slideUp 0.3s ease ${i * 30}ms both`,
              }}>
              <div className="flex items-center gap-3 p-3">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${uColor}15`, border: `1px solid ${uColor}20` }}>
                  <span className="text-[11px] font-black uppercase" style={{ color: uColor }}>{item.unit}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input className="input py-1 px-2 text-sm font-bold w-40" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    ) : (
                      <span className="text-sm font-bold text-white truncate">{item.name}</span>
                    )}
                    {isLow && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', animation: 'pulse 2s infinite' }}>
                        <AlertTriangle size={9} className="inline mr-0.5" />Baixo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] font-bold" style={{ color: isLow ? '#ef4444' : '#22c55e' }}>
                      {item.qty} {item.unit}
                    </span>
                    <span className="text-[10px] text-gray-600">mín: {item.minQty} {item.unit}</span>
                    {/* Stock bar */}
                    {item.minQty > 0 && (
                      <div className="flex-1 max-w-[100px] h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => openMove(item.id, 'entrada')} title="Entrada"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}>
                    <ArrowUpCircle size={16} />
                  </button>
                  <button onClick={() => openMove(item.id, 'saida')} title="Saída"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}>
                    <ArrowDownCircle size={16} />
                  </button>
                  <button onClick={() => isEditing ? saveEdit() : startEdit(item)} title={isEditing ? 'Salvar' : 'Editar'}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{ background: isEditing ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.1)', color: isEditing ? '#22c55e' : '#3b82f6' }}>
                    {isEditing ? <Check size={14} /> : <Edit3 size={14} />}
                  </button>
                  <button onClick={() => setHistoryId(historyId === item.id ? null : item.id)} title="Histórico"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{ background: historyId === item.id ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)', color: historyId === item.id ? '#a855f7' : '#a855f7' }}>
                    <BarChart3 size={14} />
                  </button>
                  <button onClick={() => deleteItem(item.id)} title="Excluir"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{ background: 'rgba(239,68,68,0.06)', color: '#6b7280' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = '#6b7280'; }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Move Input */}
              {isMoving && (
                <div className="px-3 pb-3 flex items-center gap-2" style={{ animation: 'slideDown 0.2s ease' }}>
                  <span className="text-[11px] font-bold" style={{ color: moveKind === 'entrada' ? '#22c55e' : '#ef4444' }}>
                    {moveKind === 'entrada' ? '＋ Entrada' : '－ Saída'}
                  </span>
                  <input className="input w-24 py-1 text-center" type="number" placeholder="Qtd"
                    value={moveQty} onChange={(e) => setMoveQty(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmMove()} autoFocus />
                  <button onClick={confirmMove}
                    className="px-3 py-1 rounded-lg text-[11px] font-bold"
                    style={{ background: moveKind === 'entrada' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: moveKind === 'entrada' ? '#22c55e' : '#ef4444' }}>
                    Confirmar
                  </button>
                  <button onClick={() => setMoveId(null)} className="text-[11px] text-gray-500 hover:text-gray-300">Cancelar</button>
                </div>
              )}

              {/* History */}
              {historyId === item.id && item.movements?.length > 0 && (
                <div className="px-3 pb-3" style={{ animation: 'slideDown 0.2s ease' }}>
                  <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {item.movements.map((m: Movement) => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: m.kind === 'entrada' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: m.kind === 'entrada' ? '#22c55e' : '#ef4444' }}>
                            {m.kind === 'entrada' ? '＋' : '－'} {m.qty}
                          </span>
                          {m.reason && <span className="text-[10px] text-gray-500">{m.reason}</span>}
                        </div>
                        <span className="text-[10px] text-gray-600">{new Date(m.createdAt).toLocaleDateString('pt-BR')} {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {historyId === item.id && (!item.movements || item.movements.length === 0) && (
                <div className="px-3 pb-3 text-center">
                  <p className="text-[11px] text-gray-600 py-2">Nenhuma movimentação registrada</p>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Package size={36} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm text-gray-500">{search ? 'Nenhum item encontrado' : 'Estoque vazio · cadastre o primeiro item'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
