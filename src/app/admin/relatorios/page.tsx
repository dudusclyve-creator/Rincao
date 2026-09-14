'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
export default function Relatorios() {
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => { fetch('/api/reports').then((r) => r.json()).then(setOrders); }, []);
  const vendas = orders.filter((o) => o.status !== 'cancelado').reduce((s, o) => s + o.total, 0);
  return (
    <div><h1 className="text-2xl font-black">Relatórios</h1>
      <div className="flex gap-2 mt-2">
        <a className="btn-ghost" href="/api/reports?format=csv">⬇ Exportar CSV</a>
        <button className="btn-ghost" onClick={() => window.print()}>⬇ PDF (imprimir)</button>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="card p-3"><p className="label">Faturamento</p><b>{BRL(vendas)}</b></div>
        <div className="card p-3"><p className="label">Pedidos</p><b>{orders.length}</b></div>
        <div className="card p-3"><p className="label">Ticket médio</p><b>{BRL(orders.length ? vendas / orders.length : 0)}</b></div>
      </div>
      <div className="card p-3 mt-3 text-sm max-h-[60vh] overflow-y-auto">
        {orders.map((o) => <div key={o.id} className="flex justify-between border-b py-1"><span>#{o.number} • {new Date(o.createdAt).toLocaleString('pt-BR')} • {o.customerName} • {o.payment} • {o.status}</span><b>{BRL(o.total)}</b></div>)}
      </div>
    </div>
  );
}
