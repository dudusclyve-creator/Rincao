'use client';
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { CartItem } from '@/lib/utils';

type CartCtx = {
  items: CartItem[];
  note: string;
  setNote: (v: string) => void;
  add: (i: CartItem) => void;
  remove: (key: string) => void;
  updateQty: (key: string, qty: number) => void;
  clear: () => void;
  subtotal: number;
};
const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [note, setNote] = useState('');
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.qty * (i.unitPrice + i.addons.reduce((a, x) => a + (x.price || 0) * (x.qty || 1), 0)), 0),
    [items]
  );
  return (
    <Ctx.Provider value={{
      items, note, setNote, subtotal,
      add: (i) => setItems((p) => {
        const sameIdx = p.findIndex((x) => x.productId === i.productId && x.note === i.note && JSON.stringify(x.addons) === JSON.stringify(i.addons));
        if (sameIdx >= 0) {
          const next = [...p];
          next[sameIdx] = { ...next[sameIdx], qty: next[sameIdx].qty + i.qty };
          return next;
        }
        return [...p, i];
      }),
      remove: (key) => setItems((p) => p.filter((x) => x.key !== key)),
      updateQty: (key, qty) => setItems((p) => p.map((x) => x.key === key ? { ...x, qty: Math.max(1, qty) } : x)),
      clear: () => { setItems([]); setNote(''); },
    }}>{children}</Ctx.Provider>
  );
}
export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart fora do provider');
  return c;
}
