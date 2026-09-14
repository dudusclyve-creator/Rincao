'use client';
import { useEffect, useState } from 'react';
export default function Estoque() {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', unit: 'un', qty: 0, minQty: 0 });
  const load = async () => setList(await fetch('/api/inventory').then((r) => r.json()));
  useEffect(() => { load(); }, []);
  return (
    <div><h1 className="text-2xl font-black">Estoque</h1>
      <div className="card p-3 mt-2 grid md:grid-cols-5 gap-2">
        <input className="input" placeholder="Item" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="Un (kg/un/L)" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
        <input className="input" type="number" placeholder="Qtd" value={f.qty || ''} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
        <input className="input" type="number" placeholder="Mínimo" value={f.minQty || ''} onChange={(e) => setF({ ...f, minQty: Number(e.target.value) })} />
        <button className="btn-primary" onClick={async () => { await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...f }) }); load(); }}>Cadastrar</button>
      </div>
      {list.map((i) => (
        <div key={i.id} className={`card p-2 mt-1 text-sm flex justify-between ${i.qty <= i.minQty ? '!border-red-400' : ''}`}>
          <span><b>{i.name}</b> • {i.qty}{i.unit} {i.qty <= i.minQty && <span className="badge bg-red-600 text-white ml-1">ESTOQUE BAIXO</span>}</span>
          <span className="flex gap-1">
            <button className="underline text-xs" onClick={async () => { const q = Number(prompt('Qtd entrada', '10')); if (q) { await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', itemId: i.id, kind: 'entrada', qty: q }) }); load(); } }}>+entrada</button>
            <button className="underline text-xs" onClick={async () => { const q = Number(prompt('Qtd saída', '1')); if (q) { await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', itemId: i.id, kind: 'saida', qty: q }) }); load(); } }}>-saída</button>
          </span>
        </div>
      ))}
    </div>
  );
}
