'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
export default function Cupons() {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ code: '', kind: 'percent', value: 10, minValue: 0, maxUses: 100, expiresAt: '' });
  const load = async () => setList(await fetch('/api/coupons').then((r) => r.json()));
  useEffect(() => { load(); }, []);
  return (
    <div><h1 className="text-2xl font-black">Cupons & Promoções</h1>
      <div className="card p-3 mt-2 grid md:grid-cols-6 gap-2">
        <input className="input" placeholder="CÓDIGO" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="percent">% percentual</option><option value="fixed">R$ fixo</option><option value="frete_gratis">frete grátis</option></select>
        <input className="input" type="number" placeholder="Valor" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} />
        <input className="input" type="number" placeholder="Mínimo" value={f.minValue} onChange={(e) => setF({ ...f, minValue: Number(e.target.value) })} />
        <input className="input" type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
        <button className="btn-primary" onClick={async () => { await fetch('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); load(); }}>Criar</button>
      </div>
      {list.map((c) => <div key={c.id} className="card p-2 mt-1 text-sm flex justify-between"><span><b>{c.code}</b> • {c.kind} {c.value} • mín {BRL(c.minValue)} • usados {c.used}/{c.maxUses} • {c.active ? 'ativo' : 'off'}</span>
        <span><button className="underline text-xs" onClick={async () => { await fetch('/api/coupons', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, active: !c.active }) }); load(); }}>on/off</button>
        <button className="underline text-xs text-red-600 ml-2" onClick={async () => { await fetch(`/api/coupons?id=${c.id}`, { method: 'DELETE' }); load(); }}>excluir</button></span></div>)}
      <p className="text-xs text-stone-500 mt-2">Promoções de produto: use Preço Promocional no cadastro do produto + datas no banner. Frete grátis por cupom tipo frete_gratis.</p>
    </div>
  );
}
