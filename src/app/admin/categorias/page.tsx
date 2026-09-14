'use client';
import { useEffect, useState } from 'react';
export default function Categorias() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const load = async () => setList(await fetch('/api/categories').then((r) => r.json()));
  useEffect(() => { load(); }, []);
  return (
    <div><h1 className="text-2xl font-black">Categorias</h1>
      <div className="flex gap-2 mt-3"><input className="input" placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={async () => { await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, order: list.length }) }); setName(''); load(); }}>Criar</button></div>
      {list.map((c, i) => (
        <div key={c.id} className="card p-2 mt-1 flex gap-2 items-center text-sm">
          <b>{c.name}</b>
          <button className="underline text-xs" onClick={async () => { await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, order: i - 1 }) }); load(); }}>↑</button>
          <button className="underline text-xs" onClick={async () => { await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, order: i + 1 }) }); load(); }}>↓</button>
          <button className="underline text-xs" onClick={async () => { const n = prompt('Renomear', c.name); if (n) { await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, name: n }) }); load(); } }}>renomear</button>
          <button className="underline text-xs text-red-600" onClick={async () => { if (confirm('Excluir?')) { await fetch(`/api/categories?id=${c.id}`, { method: 'DELETE' }); load(); } }}>excluir</button>
        </div>
      ))}
    </div>
  );
}
