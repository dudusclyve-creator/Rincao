'use client';
import { useEffect, useState } from 'react';
export default function Avaliacoes() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { fetch('/api/reviews').then((r) => r.json()).then(setList); }, []);
  const avg = list.length ? (list.reduce((s, r) => s + r.stars, 0) / list.length).toFixed(1) : '—';
  return (
    <div><h1 className="text-2xl font-black">Avaliações (média {avg}⭐)</h1>
      {list.map((r) => <div key={r.id} className="card p-3 mt-2 text-sm"><b>{'⭐'.repeat(r.stars)}</b> <span className="text-stone-500">{new Date(r.createdAt).toLocaleString('pt-BR')} • pedido {r.orderId.slice(0, 6)}</span><p>{r.comment || '—'}</p></div>)}
    </div>
  );
}
