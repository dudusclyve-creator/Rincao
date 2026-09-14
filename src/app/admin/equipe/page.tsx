'use client';
import { useEffect, useState } from 'react';
export default function Equipe() {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'caixa' });
  const load = async () => setList(await fetch('/api/users').then((r) => r.json()));
  useEffect(() => { load(); }, []);
  return (
    <div><h1 className="text-2xl font-black">Equipe & Permissões</h1>
      <div className="card p-3 mt-2 grid md:grid-cols-5 gap-2">
        <input className="input" placeholder="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="input" placeholder="Senha" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="admin">Administrador (total)</option><option value="gerente">Gerente</option><option value="caixa">Caixa</option><option value="cozinha">Cozinha</option><option value="entregador">Entregador</option></select>
        <button className="btn-primary" onClick={async () => { await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); load(); }}>Criar usuário</button>
      </div>
      {list.map((u) => <div key={u.id} className="card p-2 mt-1 text-sm flex justify-between"><span><b>{u.name}</b> • {u.email} • <span className="badge bg-stone-200">{u.role}</span></span>
        <button className="underline text-xs" onClick={async () => { await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, name: u.name, role: u.role, active: !u.active }) }); load(); }}>{u.active ? 'desativar' : 'ativar'}</button></div>)}
    </div>
  );
}
