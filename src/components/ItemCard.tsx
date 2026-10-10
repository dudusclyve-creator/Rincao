import type { ReactNode } from 'react';
import { BRL } from '@/lib/utils';

type Addon = { name: string; price: number; qty?: number };

export function ItemCard({ qty, name, unitPrice = 0, addons = [], note, total, children }: {
  qty: number;
  name: string;
  unitPrice?: number;
  addons?: Addon[];
  note?: string;
  total?: number;
  children?: ReactNode;
}) {
  const lineTotal = total ?? qty * (unitPrice + addons.reduce((s: number, a: Addon) => s + (a.price || 0) * (a.qty || 1), 0));
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-white leading-snug min-w-0">
          <span className="font-black" style={{ color: '#d4a574' }}>{qty}x</span> {name}
        </p>
        <p className="text-sm font-black text-white shrink-0">{BRL(lineTotal)}</p>
      </div>
      {(addons.length > 0 || note) ? (
        <div className="mt-1 ml-6 space-y-0.5">
          {addons.map((a: Addon, i: number) => (
            <p key={i} className="text-xs text-gray-400">+ {a.name}{a.price ? ` ${BRL(a.price * (a.qty || 1))}` : ''}</p>
          ))}
          {note ? <p className="text-xs italic" style={{ color: '#d4a574' }}>obs: {note}</p> : null}
        </div>
      ) : null}
      {children ? <div className="mt-2 ml-6 flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
