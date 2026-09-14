'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
export default function Entregas() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [name, setName] = useState('');
  const load = async () => {
    setDrivers(await fetch('/api/drivers').then((r) => r.json()));
    setOrders(await fetch('/api/orders?limit=100').then((r) => r.json()));
  };
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);
  const delivery = orders.filter((o) => o.type === 'entrega' && !['concluido', 'cancelado'].includes(o.status));
  return (
    <div><h1 className="text-2xl font-black">Entregas</h1>
      <div className="flex gap-2 mt-2"><input className="input max-w-xs" placeholder="Novo entregador" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={async () => { await fetch('/api/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); setName(''); load(); }}>Cadastrar</button></div>
      <div className="flex gap-2 mt-2 flex-wrap">{drivers.map((d) => (
        <div key={d.id} className="card p-2 text-sm flex gap-2 items-center"><b>{d.name}</b><span className="badge bg-stone-200">{d.status}</span>
          {['disponivel', 'em_entrega', 'offline'].map((s) => <button key={s} className="underline text-xs" onClick={async () => { await fetch('/api/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, status: s }) }); load(); }}>{s}</button>)}
        </div>
      ))}</div>
      <div className="grid md:grid-cols-2 gap-2 mt-3">
        {delivery.map((o) => (
          <div key={o.id} className="card p-3 text-sm">
            <b>#{o.number} • {o.customerName} • {BRL(o.total)}</b>
            <p className="text-xs">{o.addressText} • {o.customerPhone}</p>
            <select className="input mt-1" value={o.driverId || ''} onChange={async (e) => { await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, status: 'entrega', driverId: e.target.value || null }) }); load(); }}>
              <option value="">Sem entregador…</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
