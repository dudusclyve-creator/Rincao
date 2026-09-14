'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
export default function Adicionais() {
  const [groups, setGroups] = useState<any[]>([]);
  const [g, setG] = useState({ name: '', minSel: 0, maxSel: 2, required: false });
  const [a, setA] = useState({ groupId: '', name: '', price: 0 });
  const load = async () => setGroups(await fetch('/api/addon-groups').then((r) => r.json()));
  useEffect(() => { load(); }, []);
  return (
    <div><h1 className="text-2xl font-black">Grupos & Adicionais</h1>
      <div className="card p-3 mt-3 grid md:grid-cols-4 gap-2">
        <input className="input" placeholder="Nome do grupo (ex: Molhos)" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} />
        <input className="input" type="number" placeholder="Mín" value={g.minSel} onChange={(e) => setG({ ...g, minSel: Number(e.target.value) })} />
        <input className="input" type="number" placeholder="Máx" value={g.maxSel} onChange={(e) => setG({ ...g, maxSel: Number(e.target.value) })} />
        <button className="btn-primary" onClick={async () => { await fetch('/api/addon-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(g) }); setG({ name: '', minSel: 0, maxSel: 2, required: false }); load(); }}>Criar grupo</button>
      </div>
      <div className="card p-3 mt-2 grid md:grid-cols-4 gap-2">
        <select className="input" value={a.groupId} onChange={(e) => setA({ ...a, groupId: e.target.value })}><option value="">Grupo…</option>{groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <input className="input" placeholder="Adicional (ex: Bacon)" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} />
        <input className="input" type="number" placeholder="Preço" value={a.price} onChange={(e) => setA({ ...a, price: Number(e.target.value) })} />
        <button className="btn-ghost" onClick={async () => { await fetch('/api/addon-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: a.groupId, addon: { name: a.name, price: a.price } }) }); setA({ groupId: '', name: '', price: 0 }); load(); }}>Adicionar item</button>
      </div>
      {groups.map((gr) => (
        <div key={gr.id} className="card p-3 mt-2 text-sm">
          <b>{gr.name}</b> <span className="text-stone-500">min {gr.minSel} • max {gr.maxSel} {gr.required ? '• obrigatório' : ''}</span>
          <button className="underline text-red-600 text-xs ml-2" onClick={async () => { if (confirm('Excluir grupo?')) { await fetch(`/api/addon-groups?id=${gr.id}`, { method: 'DELETE' }); load(); } }}>excluir grupo</button>
          {gr.addons.map((ad: any) => <div key={ad.id} className="flex justify-between border-b py-1"><span>{ad.name} • {BRL(ad.price)}</span><button className="text-red-600 text-xs underline" onClick={async () => { await fetch(`/api/addon-groups?addonId=${ad.id}`, { method: 'DELETE' }); load(); }}>excluir</button></div>)}
        </div>
      ))}
    </div>
  );
}
