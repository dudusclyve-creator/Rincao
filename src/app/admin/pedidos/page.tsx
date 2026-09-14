'use client';
import { useEffect, useRef, useState } from 'react';
import { BRL, ORDER_STATUS, STATUS_ORDER, playNewOrderSound, receiptText } from '@/lib/utils';

export default function Pedidos() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const prevCount = useRef(0);

  const load = async () => {
    const o = await fetch('/api/orders?limit=120').then((r) => r.json());
    if (prevCount.current && o.length > prevCount.current) playNewOrderSound();
    prevCount.current = o.length;
    setOrders(o);
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const setStatus = async (id: string, status: string) => {
    await fetch('/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  };
  const print = async (o: any) => {
    const text = receiptText({
      store: 'Rincão Lanches', number: o.number, date: new Date(o.createdAt).toLocaleString('pt-BR'),
      customerName: o.customerName, customerPhone: o.customerPhone,
      items: o.items.map((it: any) => ({ qty: it.qty, name: it.name, addons: JSON.parse(it.addonsJson || '[]'), note: it.note })),
      payment: o.payment, subtotal: o.subtotal, fee: o.deliveryFee, discount: o.discount, total: o.total, width: '80mm',
    });
    await fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, printer: 'Padrao' }) });
    const w = window.open('', '_blank', 'width=320');
    w?.document.write(`<pre class="receipt">${text}</pre><script>window.print()</script>`);
  };
  const dup = async (o: any) => {
    await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      customerName: o.customerName, customerPhone: o.customerPhone, addressText: o.addressText, type: o.type, payment: o.payment,
      subtotal: o.subtotal, deliveryFee: o.deliveryFee, source: 'pdv', note: o.note,
      items: o.items.map((it: any) => ({ productId: it.productId, name: it.name, qty: it.qty, unitPrice: it.unitPrice, addons: JSON.parse(it.addonsJson || '[]'), note: it.note })),
    })});
    load();
  };

  const list = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      <h1 className="text-2xl font-black">Central de Pedidos <span className="text-sm font-normal text-stone-500">(tempo real + som)</span></h1>
      <div className="flex gap-1 mt-2 flex-wrap">
        {['all', ...STATUS_ORDER].map((s) => <button key={s} onClick={() => setFilter(s)} className={`btn-ghost !py-1 !text-xs ${filter === s ? '!bg-neutral-900 !text-white' : ''}`}>{s === 'all' ? 'Todos' : ORDER_STATUS[s]}</button>)}
      </div>
      <div className="grid md:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
        {list.map((o) => (
          <div key={o.id} className={`card p-3 ${o.status === 'novo' ? 'ring-2 ring-rose-600 animate-pulse' : ''}`}>
            <div className="flex justify-between text-sm"><b>#{o.number} • {new Date(o.createdAt).toLocaleTimeString('pt-BR')}</b><span className="badge bg-stone-900 text-white">{ORDER_STATUS[o.status]}</span></div>
            <p className="text-sm font-bold mt-1">{o.customerName} <span className="font-normal text-stone-500">{o.customerPhone}</span></p>
            <p className="text-xs text-stone-500">{o.type} • {o.payment.toUpperCase()} • {o.source}</p>
            <div className="text-xs mt-1">{o.items.map((it: any) => <div key={it.id}>{it.qty}x {it.name} {JSON.parse(it.addonsJson || '[]').map((a: any) => `+${a.name}`).join(' ')}</div>)}</div>
            {o.note && <p className="text-xs italic mt-1">obs: {o.note}</p>}
            <p className="text-xs mt-1">{o.addressText}</p>
            <p className="font-extrabold mt-1">{BRL(o.total)}</p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {STATUS_ORDER.filter((s) => s !== o.status).slice(0, 3).map((s) => (
                <button key={s} onClick={() => setStatus(o.id, s)} className="btn-ghost !text-[11px] !py-1">{ORDER_STATUS[s]}</button>
              ))}
            </div>
            <div className="flex gap-2 mt-1 text-xs">
              <button className="underline" onClick={() => print(o)}>🖨 imprimir</button>
              <button className="underline" onClick={() => dup(o)}>duplicar</button>
              <button className="underline text-red-600" onClick={() => setStatus(o.id, 'cancelado')}>cancelar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
