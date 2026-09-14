'use client';
import { useEffect, useState } from 'react';
export default function Cozinha() {
  const [orders, setOrders] = useState<any[]>([]);
  const load = async () => setOrders(await fetch('/api/orders?limit=60').then((r) => r.json()));
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  const list = orders.filter((o) => ['novo', 'confirmado', 'preparo'].includes(o.status));
  const set = async (id: string, status: string) => { await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }); load(); };
  return (
    <div className="max-w-4xl"><h1 className="text-2xl font-black">Cozinha (tablet)</h1>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        {list.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="flex justify-between"><b className="text-xl">#{o.number}</b><span className="text-sm text-stone-500">{new Date(o.createdAt).toLocaleTimeString('pt-BR')}</span></div>
            {o.items.map((it: any) => <div key={it.id} className="mt-2"><b>{it.qty}x {it.name}</b>
              {JSON.parse(it.addonsJson || '[]').map((a: any, k: number) => <div key={k} className="text-sm">+ {a.name}</div>)}
              {it.note && <div className="text-sm italic">obs: {it.note}</div>}</div>)}
            {o.note && <p className="mt-2 bg-amber-50 rounded p-2 text-sm font-bold">OBS PEDIDO: {o.note}</p>}
            <div className="grid grid-cols-3 gap-1 mt-3">
              <button className="btn-ghost" onClick={() => set(o.id, 'confirmado')}>ACEITAR</button>
              <button className="btn-ghost" onClick={() => set(o.id, 'preparo')}>EM PREPARO</button>
              <button className="btn-primary" onClick={() => set(o.id, 'pronto')}>PRONTO</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
