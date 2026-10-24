'use client';
import { useEffect, useState } from 'react';
import { Users, Plus, UserCheck, UserX, X, Check, Pencil, Mail, KeyRound, Trash2 } from 'lucide-react';
import { showToast } from '@/lib/utils';

const ROLES: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  admin: { label: 'Admin', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', desc: 'Acesso total' },
  gerente: { label: 'Gerente', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', desc: 'Acesso quase total' },
  caixa: { label: 'Caixa', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', desc: 'Pedidos, PDV, mesas, caixa' },
  cozinha: { label: 'Cozinha', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', desc: 'Cozinha e pedidos' },
  entregador: { label: 'Entregador', color: '#a855f7', bg: 'rgba(168,85,247,0.08)', desc: 'Apenas entregas' },
};

const VAZIO = { name: '', email: '', password: '', role: 'caixa' };

export default function Equipe() {
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [f, setF] = useState({ ...VAZIO });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  // exclusao com confirmacao na propria tela (nada de confirm() do sistema)
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const load = async () => setList(await fetch('/api/users').then((r) => r.json()));
  useEffect(() => { load(); }, []);

  const abrirNovo = () => {
    setEditing(null);
    setF({ ...VAZIO });
    setErr('');
    setShowForm(true);
  };

  const fechar = () => {
    setShowForm(false);
    setEditing(null);
    setF({ ...VAZIO });
    setErr('');
  };

  const abrirEdicao = (u: any) => {
    setEditing(u);
    setF({ name: u.name || '', email: u.email || '', password: '', role: u.role || 'caixa' });
    setErr('');
    setShowForm(true);
  };

  const salvar = async () => {
    if (saving) return;
    setErr('');
    if (!f.name.trim() || !f.email.trim()) { setErr('Preencha nome e e-mail'); return; }
    if (!editing && !f.password) { setErr('Escolha uma senha para o novo membro'); return; }
    setSaving(true);
    try {
      const body: any = { name: f.name, email: f.email, role: f.role, password: f.password || undefined };
      if (editing) body.id = editing.id;
      const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(data.error || 'Nao foi possivel salvar'); return; }
      fechar();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (u: any) => {
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, active: !u.active }) });
    load();
  };

  const excluir = async (u: any) => {
    setConfirmDelete(null);
    const r = await fetch(`/api/users?id=${u.id}`, { method: 'DELETE' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { showToast(data.error || 'Nao foi possivel excluir', 'error'); return; }
    if (editing?.id === u.id) fechar();
    showToast(`${u.name} excluido da equipe`, 'success');
    await load();
  };

  const activeCount = list.filter(u => u.active).length;

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Equipe</h1>
            <p className="text-[10px] text-gray-500">{list.length} membro(s) · {activeCount} ativo(s)</p>
          </div>
        </div>
        <button onClick={() => (showForm ? fechar() : abrirNovo())}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200"
          style={{ background: showForm ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, #e11d48, #be123c)', color: showForm ? '#ef4444' : '#fff', boxShadow: showForm ? 'none' : '0 4px 16px rgba(225,29,72,0.3)' }}>
          {showForm ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Novo Membro</>}
        </button>
      </div>

      {/* Form: novo / editar */}
      {showForm && (
        <div className="rounded-xl p-4 mb-5 space-y-3" style={{ background: editing ? 'rgba(59,130,246,0.04)' : 'rgba(225,29,72,0.04)', border: editing ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(225,29,72,0.15)', animation: 'slideDown 0.3s ease' }}>
          <div className="flex items-center gap-2">
            {editing ? <Pencil size={14} style={{ color: '#60a5fa' }} /> : <Plus size={14} style={{ color: '#e11d48' }} />}
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: editing ? '#60a5fa' : '#e11d48' }}>
              {editing ? `Editando: ${editing.name}` : 'Novo membro'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Nome</label>
              <input className="input w-full" placeholder="Nome completo" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">E-mail</label>
              <input className="input w-full" placeholder="email@rincao.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">
                {editing ? 'Nova senha (opcional)' : 'Senha'}
              </label>
              <input className="input w-full" type="password" placeholder={editing ? 'em branco = manter a atual' : '••••••'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Cargo</label>
              <select className="input w-full" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.desc}</option>)}
              </select>
            </div>
          </div>
          {editing && (
            <p className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <KeyRound size={11} /> A senha fica guardada com hash (bcrypt) — nem nós conseguimos ver a atual.
            </p>
          )}
          {err && <p className="text-[11px] font-bold" style={{ color: '#f87171' }}>{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={fechar} className="px-4 py-2 rounded-xl text-[12px] font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#c0b8c8' }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }}>
              <Check size={14} /> {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar Membro'}
            </button>
          </div>
        </div>
      )}

      {/* Team List */}
      <div className="space-y-2">
        {list.map((u, i) => {
          const role = ROLES[u.role] || ROLES.caixa;

          return (
            <div key={u.id} className="rounded-xl p-4 transition-all duration-200"
              style={{
                background: u.active ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                border: editing?.id === u.id ? '1px solid rgba(59,130,246,0.4)' : u.active ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.03)',
                opacity: u.active ? 1 : 0.6,
                animation: `slideUp 0.3s ease ${i * 30}ms both`,
              }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-black" style={{ background: role.bg, color: role.color }}>
                  {(u.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{u.name}</span>
                    {!u.active && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(107,114,128,0.15)', color: '#6b7280' }}>INATIVO</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] text-gray-500">
                      <Mail size={10} /> {u.email || 'sem e-mail'}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: role.bg, color: role.color }}>{role.label}</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {confirmDelete?.id === u.id ? (
                    <>
                      <span className="text-[10px] font-bold" style={{ color: '#ef4444' }}>Excluir {u.name}?</span>
                      <button onClick={() => excluir(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                        style={{ background: 'rgba(239,68,68,0.18)', color: '#ef4444' }}>
                        <Check size={12} /> Excluir
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                        <X size={12} /> Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => abrirEdicao(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-200"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                        <Pencil size={12} /> Editar
                      </button>
                      <button onClick={() => toggle(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-200"
                        style={{
                          background: u.active ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                          color: u.active ? '#ef4444' : '#22c55e',
                        }}>
                        {u.active ? <><UserX size={12} /> Desativar</> : <><UserCheck size={12} /> Ativar</>}
                      </button>
                      <button onClick={() => setConfirmDelete(u)} title="Excluir membro"
                        className="p-2 rounded-lg transition-all duration-200"
                        style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280' }}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {list.length === 0 && (
          <div className="text-center py-16">
            <Users size={36} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm text-gray-500">Nenhum membro na equipe</p>
          </div>
        )}
      </div>
    </div>
  );
}
