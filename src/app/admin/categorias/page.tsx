'use client';
import { useEffect, useState } from 'react';

// Sem prompt()/confirm() do sistema: no app portatil eles travavam o teclado.
// Renomear e excluir acontecem na propria linha.
export default function Categorias() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [delId, setDelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => setList(await fetch('/api/categories').then((r) => r.json()));
  useEffect(() => { load(); }, []);

  const patch = async (id: string, data: any) => {
    setSaving(true);
    try {
      await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...data }) });
      await load();
    } finally { setSaving(false); }
  };

  const rename = async (id: string) => {
    const n = editName.trim();
    setEditId(null);
    if (!n) return;
    await patch(id, { name: n });
  };

  const remove = async (id: string) => {
    setDelId(null);
    setSaving(true);
    try {
      await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
      await load();
    } finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-black">Categorias</h1>
      <div className="flex gap-2 mt-3">
        <input className="input" placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" disabled={!name.trim() || saving} onClick={async () => {
          await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), order: list.length }) });
          setName(''); load();
        }}>Criar</button>
      </div>
      {list.map((c, i) => (
        <div key={c.id} className="card p-2 mt-1 flex gap-2 items-center text-sm">
          {editId === c.id ? (
            <>
              <input
                autoFocus
                className="input flex-1"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') rename(c.id); if (e.key === 'Escape') setEditId(null); }}
              />
              <button className="underline text-xs text-green-600" disabled={saving} onClick={() => rename(c.id)}>salvar</button>
              <button className="underline text-xs" onClick={() => setEditId(null)}>cancelar</button>
            </>
          ) : (
            <>
              <b>{c.name}</b>
              <button className="underline text-xs" onClick={async () => { await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, order: i - 1 }) }); load(); }}>↑</button>
              <button className="underline text-xs" onClick={async () => { await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, order: i + 1 }) }); load(); }}>↓</button>
              <button className="underline text-xs" onClick={() => { setEditId(c.id); setEditName(c.name); setDelId(null); }}>renomear</button>
              {delId === c.id ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-red-500">Excluir?</span>
                  <button className="underline text-xs text-red-600 font-bold" disabled={saving} onClick={() => remove(c.id)}>sim</button>
                  <button className="underline text-xs" onClick={() => setDelId(null)}>não</button>
                </span>
              ) : (
                <button className="underline text-xs text-red-600" onClick={() => { setDelId(c.id); setEditId(null); }}>excluir</button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
