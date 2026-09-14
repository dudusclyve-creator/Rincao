'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
export default function Dashboard() {
  const [d, setD] = useState<any>(null);
  const [days, setDays] = useState(7);
  useEffect(() => { fetch(`/api/dashboard?days=${days}`).then((r) => r.json()).then(setD); }, [days]);
  if (!d) return <p>Carregando…</p>;
  const cards = [
    ['Vendas hoje', BRL(d.hoje.vendas)], ['Pedidos hoje', d.hoje.pedidos],
    ['Ticket médio', BRL(d.ticketMedio)], ['Pendentes', d.pendentes],
    ['Em preparo', d.preparo], ['Concluídos', d.concluidos], ['Cancelados', d.cancelados], ['Faturamento período', BRL(d.vendas)],
  ];
  const maxDay = Math.max(1, ...Object.values(d.byDay as Record<string, number>).map(Number));
  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-black">Dashboard</h1>
        <div className="ml-auto flex gap-1">{[1, 7, 30].map((x) => <button key={x} onClick={() => setDays(x)} className={`btn-ghost ${days === x ? '!bg-neutral-900 !text-white' : ''}`}>{x === 1 ? 'Hoje' : `${x}d`}</button>)}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {cards.map(([k, v]) => <div key={k} className="card p-4"><p className="label">{k}</p><p className="text-2xl font-black">{v}</p></div>)}
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-4">
        <div className="card p-4">
          <h3 className="font-bold">Vendas por dia</h3>
          <div className="mt-2 space-y-1">{Object.entries(d.byDay).map(([day, v]: any) => (
            <div key={day} className="flex items-center gap-2 text-xs"><span className="w-24">{day.slice(5)}</span>
              <div className="h-4 bg-rose-700 rounded" style={{ width: `${(v / maxDay) * 100}%` }} /><span>{BRL(v)}</span></div>
          ))}</div>
        </div>
        <div className="card p-4">
          <h3 className="font-bold">Formas de pagamento</h3>
          {Object.entries(d.byPay).map(([k, v]: any) => <div key={k} className="flex justify-between text-sm border-b py-1"><span className="uppercase">{k}</span><b>{BRL(v)}</b></div>)}
          <h3 className="font-bold mt-4">Produtos mais vendidos</h3>
          {d.topProdutos.map((p: any) => <div key={p.name} className="flex justify-between text-sm border-b py-1"><span>{p.name}</span><b>{p.qty}x • {BRL(p.total)}</b></div>)}
          <h3 className="font-bold mt-4">Horários de pico</h3>
          <p className="text-sm">{Object.entries(d.byHour).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([h, q]: any) => `${h} (${q})`).join(' • ')}</p>
        </div>
      </div>
    </div>
  );
}
