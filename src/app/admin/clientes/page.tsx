'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
export default function Clientes() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[]>([]);
  const load = async () => setList(await fetch(`/api/customers?q=${q}`).then((r) => r.json()));
  useEffect(() => { load(); }, []);
  return (
    <div><h1 className="text-2xl font-black">Clientes</h1>
      <div className="flex gap-2 mt-2"><input className="input" placeholder="Buscar por nome ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn-ghost" onClick={load}>Buscar</button></div>
      <div className="grid md:grid-cols-2 gap-2 mt-3">
        {list.map((c) => (
          <div key={c.id} className="card p-3 text-sm">
            <b>{c.name}</b> <span className="text-stone-500">{c.phone}</span>
            <p className="text-xs">{c.street}, {c.number} - {c.district}</p>
            <p className="text-xs mt-1">Pedidos: <b>{c.orderCount}</b> • Total: <b>{BRL(c.totalSpent)}</b> • Ticket: <b>{BRL(c.ticketMedio)}</b></p>
            <p className="text-xs">Último: {c.lastOrder ? new Date(c.lastOrder).toLocaleString('pt-BR') : '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
