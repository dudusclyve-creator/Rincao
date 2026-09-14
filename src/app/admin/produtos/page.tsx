'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
export default function Produtos() {
  const [list, setList] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [f, setF] = useState<any>({ name: '', price: '', categoryId: '', groupIds: [] });
  const [edit, setEdit] = useState<any>(null);
  const load = async () => {
    setList(await fetch('/api/products').then((r) => r.json()));
    setCats(await fetch('/api/categories').then((r) => r.json()));
    setGroups(await fetch('/api/addon-groups').then((r) => r.json()));
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    const url = '/api/products';
    const body = edit ? { ...edit, ...f, price: Number(f.price), promoPrice: f.promoPrice ? Number(f.promoPrice) : null } : { ...f, price: Number(f.price), description: f.description || '', promoPrice: f.promoPrice ? Number(f.promoPrice) : null };
    await fetch(url, { method: edit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setF({ name: '', price: '', categoryId: '', groupIds: [] }); setEdit(null); load();
  };
  return (
    <div>
      <h1 className="text-2xl font-black">Produtos (CRUD completo)</h1>
      <div className="card p-4 mt-3 grid md:grid-cols-4 gap-2">
        <input className="input" placeholder="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="Preço" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <input className="input" placeholder="Preço promo (opcional)" type="number" value={f.promoPrice || ''} onChange={(e) => setF({ ...f, promoPrice: e.target.value })} />
        <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}><option value="">Categoria…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input className="input md:col-span-2" placeholder="Descrição" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className="input" placeholder="Foto URL (opcional)" value={f.photoUrl || ''} onChange={(e) => setF({ ...f, photoUrl: e.target.value })} />
        <div className="flex gap-2 text-xs items-center flex-wrap">{groups.map((g) => <label key={g.id} className="flex gap-1 items-center"><input type="checkbox" checked={f.groupIds?.includes(g.id)} onChange={(e) => setF({ ...f, groupIds: e.target.checked ? [...(f.groupIds || []), g.id] : f.groupIds.filter((x: string) => x !== g.id) })} />{g.name}</label>)}</div>
        <div className="flex gap-2 text-xs items-center">{['featured', 'bestSeller', 'available'].map((k) => <label key={k} className="flex gap-1 items-center"><input type="checkbox" checked={k === 'available' ? (f.available ?? true) : !!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{k}</label>)}</div>
        <button className="btn-primary md:col-span-4" onClick={save}>{edit ? 'Salvar edição' : 'Criar produto'}</button>
        {edit && <button className="btn-ghost md:col-span-4" onClick={() => { setEdit(null); setF({ name: '', price: '', categoryId: '', groupIds: [] }); }}>Cancelar edição</button>}
      </div>
      <div className="grid md:grid-cols-2 gap-2 mt-3">
        {list.map((p) => (
          <div key={p.id} className="card p-3 text-sm flex justify-between gap-2">
            <div><b>{p.name}</b> <span className="text-stone-500">• {p.category?.name} • {BRL(p.promoPrice ?? p.price)} {p.available ? '' : '(off)'}</span>
              <p className="text-xs text-stone-500">{p.description}</p></div>
            <div className="flex flex-col gap-1 text-xs shrink-0">
              <button className="underline" onClick={() => { setEdit(p); setF({ name: p.name, price: p.price, promoPrice: p.promoPrice || '', categoryId: p.categoryId, description: p.description, photoUrl: p.photoUrl, available: p.available, featured: p.featured, bestSeller: p.bestSeller, groupIds: p.groups.map((g: any) => g.groupId) }); }}>editar</button>
              <button className="underline" onClick={async () => { await fetch(`/api/products?id=${p.id}&duplicate=1`, { method: 'DELETE' }); load(); }}>duplicar</button>
              <button className="underline" onClick={async () => { await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, available: !p.available }) }); load(); }}>{p.available ? 'desativar' : 'ativar'}</button>
              <button className="underline text-red-600" onClick={async () => { if (confirm('Excluir?')) { await fetch(`/api/products?id=${p.id}`, { method: 'DELETE' }); load(); } }}>excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
