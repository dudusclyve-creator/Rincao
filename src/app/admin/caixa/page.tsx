'use client';
import { useEffect, useState } from 'react';
import { BRL } from '@/lib/utils';
export default function Caixa() {
  const [data, setData] = useState<any>(null);
  const [op, setOp] = useState('Operador');
  const [initial, setInitial] = useState(100);
  const [mov, setMov] = useState({ kind: 'sangria', method: 'dinheiro', amount: 0, reason: '' });
  const [informed, setInformed] = useState(0);
  const load = async () => setData(await fetch('/api/cash').then((r) => r.json()));
  useEffect(() => { load(); }, []);
  if (!data) return <p>Carregando caixa…</p>;
  const byMethod = (list: any[]) => {
    const m: Record<string, number> = {};
    list.filter((x) => x.kind === 'venda').forEach((x) => { m[x.method] = (m[x.method] || 0) + x.amount; });
    return m;
  };
  return (
    <div>
      <h1 className="text-2xl font-black">Caixa</h1>
      {!data.open ? (
        <div className="card p-4 mt-3 max-w-md">
          <p className="label">Abertura de caixa</p>
          <input className="input mt-1" value={op} onChange={(e) => setOp(e.target.value)} placeholder="Operador" />
          <input className="input mt-2" type="number" value={initial} onChange={(e) => setInitial(Number(e.target.value))} placeholder="Valor inicial" />
          <button className="btn-primary w-full mt-2" onClick={async () => { await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', operator: op, initial }) }); load(); }}>Abrir caixa</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div className="card p-4">
            <p>Aberto por <b>{data.open.operator}</b> em {new Date(data.open.openedAt).toLocaleString('pt-BR')} — inicial {BRL(data.open.initial)}</p>
            <p className="text-sm mt-1">Por método: {Object.entries(byMethod(data.open.movements)).map(([k, v]: any) => `${k}: ${BRL(v)}`).join(' • ') || '—'}</p>
            <p className="text-sm">Movimentações: {data.open.movements.length}</p>
            <div className="mt-2 space-y-1 max-h-56 overflow-y-auto text-sm">
              {data.open.movements.map((m: any) => <div key={m.id} className="flex justify-between border-b py-1"><span>{m.kind} • {m.method} • {m.reason}</span><b>{BRL(m.amount)}</b></div>)}
            </div>
          </div>
          <div className="card p-4">
            <p className="label">Registrar entrada/saída/sangria/suprimento</p>
            <div className="flex gap-1 mt-1 flex-wrap">{['entrada', 'saida', 'sangria', 'suprimento'].map((k) => <button key={k} onClick={() => setMov({ ...mov, kind: k })} className={`btn-ghost !text-xs ${mov.kind === k ? '!bg-neutral-900 !text-white' : ''}`}>{k}</button>)}</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input className="input" type="number" placeholder="Valor" value={mov.amount || ''} onChange={(e) => setMov({ ...mov, amount: Number(e.target.value) })} />
              <input className="input" placeholder="Motivo" value={mov.reason} onChange={(e) => setMov({ ...mov, reason: e.target.value })} />
            </div>
            <button className="btn-ghost w-full mt-2" onClick={async () => { await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'movement', ...mov }) }); load(); }}>Registrar</button>
            <div className="mt-3">
              <p className="label">Fechamento (valor informado em dinheiro)</p>
              <input className="input mt-1" type="number" value={informed || ''} onChange={(e) => setInformed(Number(e.target.value))} />
              <button className="btn-primary w-full mt-2" onClick={async () => {
                const r = await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close', informed }) }).then((x) => x.json());
                alert(`Esperado ${BRL(r.expected)} • Informado ${BRL(r.informed)} • Diferença ${BRL(r.diff)}`);
                load();
              }}>Fechar caixa + relatório</button>
              <button className="btn-ghost w-full mt-1" onClick={() => window.print()}>🖨 Imprimir fechamento</button>
            </div>
          </div>
        </div>
      )}
      <h2 className="font-bold mt-4">Histórico</h2>
      {data.history.map((h: any) => <div key={h.id} className="card p-2 mt-1 text-sm flex justify-between"><span>{h.operator} • {new Date(h.openedAt).toLocaleString('pt-BR')} • {h.status}</span><b>{BRL(h.movements.filter((m: any) => m.kind === 'venda').reduce((s: number, m: any) => s + m.amount, 0))}</b></div>)}
    </div>
  );
}
