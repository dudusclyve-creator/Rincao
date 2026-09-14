'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';

export default function PDV() {
  const [menu, setMenu] = useState<any>(null);
  const [cat, setCat] = useState('all');
  const [cart, setCart] = useState<any[]>([]);
  const [type, setType] = useState('balcao');
  const [payment, setPayment] = useState('pix');
  const [discount, setDiscount] = useState(0);
  const [client, setClient] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { fetch('/api/menu').then((r) => r.json()).then(setMenu); }, []);
  if (!menu) return <p>Carregando PDV…</p>;
  const products = menu.products.filter((p: any) => cat === 'all' || p.categoryId === cat);
  const sub = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const total = Math.max(0, sub - discount);

  const finish = async () => {
    const o = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      customerName: client || 'Balcão', customerPhone: '', addressText: type.toUpperCase(), type, payment,
      subtotal: sub, deliveryFee: 0, discount, source: 'pdv', note,
      items: cart.map((i) => ({ productId: i.id, name: i.name, qty: i.qty, unitPrice: i.unitPrice, addons: [], note: '' })),
    })}).then((r) => r.json());
    await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'movement', kind: 'venda', method: payment, amount: o.total, orderId: o.id, reason: `PDV #${o.number}` }) });
    alert(`Venda #${o.number} finalizada: ${BRL(o.total)} (impressão enviada)`);
    setCart([]); setDiscount(0); setNote('');
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-black">PDV — Balcão / Mesa / Retirada</h1>
        <div className="flex gap-1 mt-2 flex-wrap">
          <button onClick={() => setCat('all')} className="btn-ghost !text-xs">Todas</button>
          {menu.categories.map((c: any) => <button key={c.id} onClick={() => setCat(c.id)} className={`btn-ghost !text-xs ${cat === c.id ? '!bg-neutral-900 !text-white' : ''}`}>{c.name}</button>)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
          {products.map((p: any) => (
            <button key={p.id} disabled={!p.available} onClick={() => {
              const ex = cart.find((i) => i.id === p.id);
              if (ex) setCart(cart.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
              else setCart([...cart, { id: p.id, name: p.name, unitPrice: p.promoPrice ?? p.price, qty: 1 }]);
            }} className="card p-3 text-left disabled:opacity-40">
              <b className="text-sm">{p.name}</b><p className="font-extrabold text-rose-700">{BRL(p.promoPrice ?? p.price)}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="card p-4 h-fit sticky top-4">
        <h3 className="font-bold">Venda atual</h3>
        {cart.map((i) => <div key={i.id} className="flex justify-between text-sm border-b py-1"><span>{i.qty}x {i.name}</span><span>{BRL(i.qty * i.unitPrice)} <button className="text-red-600 ml-1" onClick={() => setCart(cart.filter((x) => x.id !== i.id))}>x</button></span></div>)}
        <div className="flex gap-1 mt-2">{['balcao', 'mesa', 'retirada', 'entrega'].map((t) => <button key={t} onClick={() => setType(t)} className={`btn-ghost !text-xs capitalize ${type === t ? '!bg-neutral-900 !text-white' : ''}`}>{t}</button>)}</div>
        <div className="flex gap-1 mt-1">{['pix', 'dinheiro', 'debito', 'credito'].map((p) => <button key={p} onClick={() => setPayment(p)} className={`btn-ghost !text-xs ${payment === p ? '!bg-rose-700 !text-white' : ''}`}>{p}</button>)}</div>
        <input className="input mt-2" placeholder="Cliente (opcional)" value={client} onChange={(e) => setClient(e.target.value)} />
        <input className="input mt-2" placeholder="Observação" value={note} onChange={(e) => setNote(e.target.value)} />
        <input className="input mt-2" type="number" placeholder="Desconto R$" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value))} />
        <p className="text-xl font-black mt-2">Total {BRL(total)}</p>
        <button onClick={finish} disabled={!cart.length} className="btn-primary w-full mt-2 disabled:opacity-40">Finalizar venda + imprimir</button>
      </div>
    </div>
  );
}
