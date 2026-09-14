'use client';
import { useEffect, useState } from 'react';
export default function Promocoes() {
  return (
    <div><h1 className="text-2xl font-black">Promoções</h1>
      <p className="text-sm text-stone-500 mt-1">Gerencie preços promocionais direto no produto + cupons de desconto. Para combos, crie um produto “Combo” com preço promocional.</p>
      <a href="/admin/produtos" className="btn-primary mt-3 inline-flex">Ir para produtos</a>
      <a href="/admin/cupons" className="btn-ghost mt-3 ml-2 inline-flex">Ir para cupons</a>
    </div>
  );
}
