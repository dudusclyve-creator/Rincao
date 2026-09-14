'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
export default function Mesas() {
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const load = async () => {
    setTables(await fetch('/api/tables').then((r) => r.json()));
    setOrders(await fetch('/api/orders?limit=200').then((r) => r.json()));
  };
  useEffect(() => { load(); }, []);
  const setStatus = async (id: string, status: string) => {
    await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id, status }) });
    load();
  };
  return (
    <div>
      <h1 className="text-2xl font-black">Mesas</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        {tables.map((t) => {
          const tbOrders = orders.filter((o) => o.tableId === t.id && !['concluido', 'cancelado'].includes(o.status));
          const total = tbOrders.reduce((s, o) => s + o.total, 0);
          return (
            <div key={t.id} className={`card p-4 ${t.status === 'livre' ? '' : t.status === 'ocupada' ? '!border-amber-400' : '!border-rose-500'}`}>
              <b>{t.number}</b>
              <span className={`badge ml-2 ${t.status === 'livre' ? 'bg-green-100 text-green-800' : t.status === 'ocupada' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{t.status}</span>
              <p className="text-sm mt-1">{tbOrders.length} pedido(s) • {BRL(total)}</p>
              <div className="flex gap-1 mt-2 flex-wrap">
                <button className="btn-ghost !text-xs" onClick={() => setStatus(t.id, 'ocupada')}>Abrir</button>
                <button className="btn-ghost !text-xs" onClick={() => setStatus(t.id, 'fechamento')}>Fechamento</button>
                <button className="btn-ghost !text-xs" onClick={() => setStatus(t.id, 'livre')}>Fechar/Liberar</button>
                <button className="btn-ghost !text-xs" onClick={() => window.print()}>🖨 conta</button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-stone-500 mt-3">QR Code da mesa: /cardapio?mesa=Mesa 01 (abre a mesa correspondente). QR geral em Configurações.</p>
    </div>
  );
}
