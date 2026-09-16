'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/lib/store';
import { BRL, isOpenNow, buildWhatsMessage, type CartAddon } from '@/lib/utils';

type Product = any;

const EMOJI: Record<string, string> = {
  COMBOS: '🍔', 'CAIXAS E TÁBUAS': '🍱', XIS: '🍔', TORRADAS: '🥪',
  'CACHORRO QUENTE': '🌭', PASTÉIS: '🥟', PIZZAS: '🍕', PORÇÕES: '🍟',
  ADICIONAIS: '🧀', BEBIDAS: '🥤',
};

const WA_GREEN = '#25D366';

// Paleta exata do referência
const C = {
  bg: '#3A2010',
  bgCard: '#5c3a1e',
  bgCardHover: '#6b4423',
  bgChip: '#3a2515',
  bgChipActive: '#4a3020',
  textName: '#e8d5c0',
  textPrice: '#d4a574',
  textDesc: '#a08060',
  textMuted: '#7a6a5a',
  textLight: '#f0e6d8',
  border: '#4a3525',
};

const DELIVERY_ZONES: Record<string, { name: string; fee: number }[]> = {
  'Santana do Livramento': [
    { name: 'Centro', fee: 5 }, { name: 'Boa Vista', fee: 5 }, { name: 'Sao Jose', fee: 6 },
    { name: 'Cidade Alta', fee: 6 }, { name: 'Liberdade', fee: 7 }, { name: 'Jardim do Sol', fee: 7 },
    { name: 'Parque Industrial', fee: 8 }, { name: 'Vila Nova', fee: 8 }, { name: 'Bela Vista', fee: 9 },
    { name: 'Floresta', fee: 9 }, { name: 'Santo Antonio', fee: 10 },
  ],
  'Rivera': [
    { name: 'Centro', fee: 8 }, { name: 'Paz', fee: 8 }, { name: 'Santa Cruz', fee: 9 },
    { name: 'Monaco', fee: 10 }, { name: 'Maria Clara', fee: 10 }, { name: 'Floresta', fee: 12 },
    { name: 'Interlagos', fee: 12 }, { name: 'Sao Jorge', fee: 14 },
  ],
};

export default function CardapioPage() {
  const [data, setData] = useState<any>(null);
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState('entrega');
  const [addressText, setAddressText] = useState('');
  const [deliveryStep, setDeliveryStep] = useState(0);
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryBairro, setDeliveryBairro] = useState('');
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryNum, setDeliveryNum] = useState('');
  const [deliveryComp, setDeliveryComp] = useState('');
  const cart = useCart();
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch('/api/menu').then((r) => r.json()).then(setData); }, []);

  const selectCat = (id: string) => {
    setCat(id);
    if (tabsRef.current) {
      const tab = tabsRef.current.querySelector(`[data-tab-id='``]`) as HTMLElement | null;
      tab?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const open = useMemo(() => data?.restaurant ? isOpenNow(data.restaurant.hoursJson, data.restaurant.isOpenManual) : true, [data]);
  const products: Product[] = useMemo(() => {
    let p = data?.products || [];
    if (cat === 'best') p = p.filter((x: any) => x.bestSeller);
    else if (cat !== 'all') p = p.filter((x: any) => x.categoryId === cat);
    if (search) p = p.filter((x: any) => (x.name + ' ' + x.description).toLowerCase().includes(search.toLowerCase()));
    return p;
  }, [data, cat, search]);

  const catName = useMemo(() => {
    if (cat === 'all') return 'Todos';
    if (cat === 'best') return 'Mais pedidos';
    return data?.categories?.find((c: any) => c.id === cat)?.name || '';
  }, [cat, data]);

  const grouped = useMemo(() => {
    if (cat !== 'all' || search) return [{ name: catName, items: products }];
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const cn = p.category?.name || 'Outros';
      if (!map.has(cn)) map.set(cn, []);
      map.get(cn)!.push(p);
    }
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  }, [products, cat, search, catName]);

  if (!data) return <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}><p className="font-bold animate-pulse" style={{ color: C.textMuted }}>Carregando…</p></div>;
  const R = data.restaurant;
  const totalItems = cart.items.reduce((s: number, i: any) => s + i.qty, 0);

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.textLight }}>
      {/* ===== HEADER FIXO ===== */}
      <header className="sticky top-0 z-30 backdrop-blur border-b" style={{ background: C.bg + 'f0', borderColor: C.border + '30' }}>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-black text-sm lg:text-base truncate" style={{ color: C.textLight }}>Rincão Lanches</h1>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shrink-0" style={{ background: open ? WA_GREEN : '#dc2626' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {open ? 'ABERTO' : 'FECHADO'}
            </span>
            <span className="text-[10px] hidden sm:inline" style={{ color: C.textMuted }}>• 30–45 min</span>
          </div>
          <a href={`https://wa.me/${R.whatsapp}`} target="_blank" className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold text-white shrink-0" style={{ background: WA_GREEN }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
        </div>
      </header>

      {/* ===== BANNER ===== */}
      <div className="relative w-full max-w-[1400px] mx-auto">
        <div className="relative h-[240px] lg:h-[320px] overflow-hidden">
          {R.bannerUrl
            ? <img src={R.bannerUrl} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full" style={{ background: `linear-gradient(180deg, ${C.bgCard} 0%, ${C.bg} 100%)` }} />}
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${C.bg}, ${C.bg}80 40%, transparent)` }} />
        </div>
        <div className="absolute bottom-0 inset-x-0 px-6 lg:px-10 pb-4">
          <div className="flex items-end gap-4">
            {R.logoUrl && <img src={R.logoUrl} alt={R.name} className="w-28 h-28 lg:w-36 lg:h-36 rounded-full object-cover shadow-2xl" style={{ border: `3px solid ${C.border}` }} />}
            <div>
              <h2 className="font-black text-xl lg:text-2xl" style={{ color: C.textLight }}>{R.name}</h2>
              <p className="text-[10px] lg:text-xs mt-0.5 italic" style={{ color: C.textMuted }}>O melhor sabor da fronteira</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#d4a574' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <div className="overflow-hidden flex-1">
                  <div className="animate-marquee whitespace-nowrap">
                    <span className="text-[10px] lg:text-xs" style={{ color: C.textMuted }}>{R.address}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-12 z-20 border-b" style={{ background: C.bg, borderColor: C.border + '30' }}>
        <div className="max-w-[1400px] mx-auto overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 lg:px-8 py-2.5 min-w-max">
            <button onClick={() => selectCat('all')} className="whitespace-nowrap rounded-full px-4 py-1.5 text-[11px] font-bold transition" style={cat === 'all' ? { background: C.bgChipActive, color: C.textLight } : { background: C.bgChip, color: C.textMuted }}>Todos</button>
            <button onClick={() => selectCat('best')} className="whitespace-nowrap rounded-full px-4 py-1.5 text-[11px] font-bold transition" style={cat === 'best' ? { background: C.bgChipActive, color: C.textLight } : { background: C.bgChip, color: C.textMuted }}>⭐ Mais pedidos</button>
            {data.categories.map((c: any) => (
              <button key={c.id} onClick={() => selectCat(c.id)} className="whitespace-nowrap rounded-full px-4 py-1.5 text-[11px] font-bold uppercase transition" style={cat === c.id ? { background: C.bgChipActive, color: C.textLight } : { background: C.bgChip, color: C.textMuted }}>{c.name}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== BUSCA (mobile) ===== */}
      <div className="lg:hidden px-4 py-2">
        <input className="w-full rounded-xl px-4 py-2 text-sm outline-none" style={{ background: C.bgChip, border: `1px solid ${C.border}`, color: C.textLight }} placeholder="🔍 Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* ===== CONTEÚDO ===== */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex gap-4">
        <main className="flex-1 min-w-0 pb-32 lg:pb-8">
          {!open && <div className="rounded-xl p-3 text-sm font-bold text-center mb-4" style={{ background: '#3a1515', color: '#f87171', border: '1px solid #5a2020' }}>Estamos fechados no momento.</div>}

          {search && <p className="text-xs mb-3" style={{ color: C.textMuted }}>Resultados para "{search}"</p>}

          {grouped.map((group) => (
            <div key={group.name} className="mb-5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="rounded-full px-4 py-1 text-[11px] font-bold uppercase" style={{ background: C.bgChip, color: C.textName }}>{group.name}</span>
                <span className="text-[10px]" style={{ color: C.textMuted }}>{group.items.length} {group.items.length === 1 ? 'item' : 'itens'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {group.items.map((p: any) => {
                  const price = p.promoPrice ?? p.price;
                  const soldOut = !p.available;
                  return (
                    <button key={p.id} onClick={() => !soldOut && setModal(p)} disabled={soldOut} className="flex gap-3 p-2.5 rounded-xl text-left transition disabled:opacity-40 disabled:cursor-not-allowed group" style={{ background: C.bgCard, border: `1px solid ${C.border}40` }}>
                      <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-lg flex items-center justify-center text-3xl shrink-0 overflow-hidden" style={{ background: C.bg }}>
                        {p.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" /> : <span style={{ color: C.textMuted }}>{EMOJI[p.category?.name] || '🍽'}</span>}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-xs lg:text-sm uppercase" style={{ color: C.textName }}>{p.name}</h3>
                          <p className="text-[10px] lg:text-[11px] line-clamp-2 mt-0.5 leading-relaxed" style={{ color: C.textDesc }}>{p.description}</p>
                        </div>
                        <p className="font-extrabold text-sm lg:text-base" style={{ color: p.promoPrice ? '#22c55e' : C.textPrice }}>{BRL(price)} {p.promoPrice && <s className="font-normal text-[10px]" style={{ color: C.textMuted }}>{BRL(p.price)}</s>}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-wrap shrink-0">
                        {p.newArrival && (<span className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white bg-gradient-to-r from-green-500 to-green-600">✨ Novidade!</span>)}
                        {p.bestSeller && (
                          <span className="badge-popular inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-red-500">
                            🔥Popular
                          </span>
                        )}
                        {p.category?.name === 'BEBIDAS' && (
                          <span className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: '#38bdf8' }}>❄️ Gelado</span>
                        )}
                        {soldOut && <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold text-white bg-red-600">Indisponível</span>}
                        {p.promoPrice && <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold text-white bg-red-600">-{Math.round(Math.abs((p.promoPrice - p.price) / p.price) * 100)}%</span>}
                        {p.promoPrice && <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold text-white bg-amber-600">Promo</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-center py-16 text-sm" style={{ color: C.textMuted }}>Nenhum item encontrado.</p>}
        </main>

        {/* CARRINHO LATERAL (desktop) */}
        <aside className="hidden lg:flex w-[300px] shrink-0 flex-col sticky relative" style={{ top: '116px', alignSelf: 'flex-start' }}>
          <div className="rounded-2xl w-full flex flex-col shadow-lg" style={{ background: '#f5ede4', color: '#3a2010' }}>
            {/* Endereço */}
            <button onClick={() => setAddressOpen(!addressOpen)} className="flex items-center justify-between px-4 py-3 text-left w-full cursor-pointer hover:opacity-80 transition rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#e0d5c8' }}>
                  <svg className="w-4 h-4" style={{ color: '#3a2010' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold" style={{ color: '#3a2010' }}>{deliveryType === 'entrega' && addressText ? addressText : deliveryType === 'retirada' ? 'Retirada no local' : deliveryType === 'local' ? 'Consumo no local' : 'Adicionar endereço'}</p>
                  <p className="text-[10px] font-bold" style={{ color: '#9a8a7a' }}>{deliveryType !== 'entrega' ? 'R$ 0,00' : BRL(R.deliveryFee)}</p>
                </div>
              </div>
              <svg className="w-4 h-4 shrink-0" style={{ color: '#b0a090', transform: addressOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>

            {/* Itens ou vazio */}
            <div className="overflow-y-auto px-4 py-3">
              {cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2" style={{ background: '#e0d5c8' }}>
                    <svg className="w-7 h-7" style={{ color: '#b0a090' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                  </div>
                  <p className="text-[12px] font-medium" style={{ color: '#b0a090' }}>Sacola vazia</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.items.map((i) => {
                    const total = i.qty * (i.unitPrice + i.addons.reduce((s: number, a: CartAddon) => s + a.price * (a.qty || 1), 0));
                    const product = data?.products?.find((p: any) => p.id === i.productId);
                    return (
                      <div key={i.key} className="flex gap-2.5 pb-3" style={{ borderBottom: '1px solid #e0d5c8' }}>
                        {product?.photoUrl && (
                          <img src={product.photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="text-[11px] font-bold flex-1 pr-1">{i.qty}x {i.name}</p>
                            <span className="text-[11px] font-bold shrink-0">{BRL(total)}</span>
                          </div>
                          {i.addons.length > 0 && (
                            <div className="mt-0.5">
                              {i.addons.map((a: CartAddon, k: number) => (
                                <p key={k} className="text-[9px]" style={{ color: '#9a8a7a' }}>+ {a.name}{a.qty && a.qty > 1 ? ` (${a.qty}x)` : ''}</p>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid #d5cab9' }}>
                              <button className="w-6 h-6 flex items-center justify-center text-xs font-bold" style={{ background: '#e8dfd6', color: '#3a2010' }} onClick={() => cart.updateQty(i.key, i.qty - 1)}>−</button>
                              <span className="w-6 h-6 flex items-center justify-center text-[11px] font-bold">{i.qty}</span>
                              <button className="w-6 h-6 flex items-center justify-center text-xs font-bold" style={{ background: '#e8dfd6', color: '#3a2010' }} onClick={() => cart.updateQty(i.key, i.qty + 1)}>+</button>
                            </div>
                            <button className="text-[10px] underline" style={{ color: '#9a8a7a' }} onClick={() => cart.remove(i.key)}>Remover</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid #e0d5c8' }}>
              {cart.items.length > 0 && (
                <>
                  <p className="text-[11px] font-bold mb-1" style={{ color: '#3a2010' }}>Tem um cupom?</p>
                  <p className="text-[10px] mb-2" style={{ color: '#9a8a7a' }}>Clique e insira o código</p>
                  <button onClick={() => setCheckout(true)} className="w-full rounded-xl py-3 font-bold text-white text-[13px]" style={{ background: '#8b5e2a' }}>Finalizar pedido</button>
                </>
              )}
            </div>
          </div>

          {/* Popup de recebimento - fora do rounded div, no nível do aside */}
          {addressOpen && (
            <div className="absolute left-0 right-0 z-30 rounded-xl p-4 shadow-xl" style={{ top: '52px', background: '#f5ede4', border: '1px solid #e0d5c8' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-2.5" style={{ color: '#8b7a6a' }}>Como você quer receber o pedido?</p>
              <div className="space-y-1.5">
                {[
                  { id: 'entrega', icon: '🏪', label: 'Entrega', desc: 'A gente leva até você' },
                  { id: 'retirada', icon: '🚶', label: 'Retirada', desc: 'Você retira no local' },
                  { id: 'local', icon: '🏠', label: 'Consumo no local', desc: 'Você consome no local' },
                ].map((t) => (
                  <button key={t.id} onClick={() => { setDeliveryType(t.id); if (t.id !== 'entrega') setAddressOpen(false); }} className="w-full flex items-center gap-3 p-2.5 rounded-xl transition text-left" style={deliveryType === t.id ? { background: '#f0e6d8', border: '1px solid #d5cab9' } : { background: 'transparent', border: '1px solid transparent' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: '#e0d5c8' }}>{t.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold" style={{ color: '#3a2010' }}>{t.label}</p>
                      <p className="text-[9px]" style={{ color: '#9a8a7a' }}>{t.desc}</p>
                    </div>
                    {deliveryType === t.id && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#8b5e2a' }}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {deliveryType === 'entrega' && (
                <button onClick={() => { setAddressOpen(false); setCheckout(true); }} className="w-full rounded-xl py-2.5 font-bold text-white text-[12px] mt-3" style={{ background: '#8b5e2a' }}>Continuar</button>
              )}
            </div>
          )}
        </aside>
        </div>
      </div>

      {/* ===== MOBILE CART BAR ===== */}
      {cart.items.length > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} className="lg:hidden fixed bottom-4 inset-x-4 rounded-2xl py-3.5 font-bold text-white shadow-xl z-20 flex items-center justify-between px-5" style={{ background: '#8b2e0a' }}>
          <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{totalItems}</span>Ver sacola</span>
          <span>{BRL(cart.subtotal)}</span>
        </button>
      )}

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckout(true); }} products={data.products} />}
      {checkout && <CheckoutModal restaurant={R} onClose={() => setCheckout(false)} deliveryType={deliveryType} deliveryFee={deliveryType === 'entrega' ? R.deliveryFee : 0} addressText={addressText} />}
      {modal && <ProductModal product={modal} onClose={() => setModal(null)} onAdded={() => setModal(null)} allProducts={data?.products || []} />}
    </div>
  );
}

/* ======================== PRODUCT MODAL ======================== */
function ProductModal({ product, onClose, onAdded, allProducts }: any) {
  const drinksRef = useRef<HTMLDivElement>(null);
  const drinks = (allProducts || []).filter((p: any) => p.category?.name === 'BEBIDAS' && p.id !== product.id && p.available).slice(0, 8);
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [sel, setSel] = useState<Record<string, CartAddon[]>>({});
  const groups = product.groups?.map((g: any) => g.group) || [];
  const price = product.promoPrice ?? product.price;

  const toggle = (g: any, a: any) => {
    const cur = sel[g.id] || [];
    const has = cur.find((x) => x.name === a.name);
    let next: CartAddon[];
    if (has) next = cur.filter((x) => x.name !== a.name);
    else {
      if (cur.reduce((s, x) => s + (x.qty || 1), 0) + 1 > g.maxSel) { alert(`Máximo de ${g.maxSel} em "${g.name}"`); return; }
      next = [...cur, { name: a.name, price: a.price, qty: 1 }];
    }
    setSel({ ...sel, [g.id]: next });
  };

  const valid = groups.every((g: any) => {
    const n = (sel[g.id] || []).reduce((s, x) => s + (x.qty || 1), 0);
    if (g.required && n < Math.max(1, g.minSel)) return false;
    return n >= g.minSel;
  });

  const total = qty * (price + Object.values(sel).flat().reduce((s, a) => s + (a.price || 0) * (a.qty || 1), 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl" style={{ background: '#e8d5c0', color: C.bgChip }} onClick={(e) => e.stopPropagation()}>
        <div className="relative h-48 overflow-hidden rounded-t-2xl" style={{ background: C.bgCard }}>
          {product.photoUrl
            ? <img src={product.photoUrl} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center text-6xl" style={{ color: C.textMuted }}>{EMOJI[product.category?.name] || '🍽'}</div>}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm text-white" style={{ background: 'rgba(0,0,0,0.5)' }}>✕</button>
        </div>
        <div className="p-5">
          <h2 className="text-lg font-black uppercase" style={{ color: C.bgChip }}>{product.name}</h2>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: C.textMuted }}>{product.description}</p>
          <p className="font-extrabold text-xl mt-2" style={{ color: '#8b2e0a' }}>{BRL(price)} {product.promoPrice && <s className="font-normal text-xs" style={{ color: C.textMuted }}>{BRL(product.price)}</s>}</p>

          {groups.map((g: any) => (
            <div key={g.id} className="mt-4 rounded-xl p-3" style={{ background: 'white', border: `1px solid ${C.border}20` }}>
              <p className="font-bold text-xs" style={{ color: C.bgChip }}>{g.name} {g.required && <span className="text-red-600">*obrigatório</span>} <span style={{ color: C.textMuted }}>({(sel[g.id] || []).reduce((s: number, x: any) => s + (x.qty || 1), 0)}/{g.maxSel})</span></p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {g.addons?.filter((a: any) => a.active).map((a: any) => {
                  const on = (sel[g.id] || []).some((x) => x.name === a.name);
                  return (
                    <button key={a.id} onClick={() => toggle(g, a)} className="flex justify-between items-center border-2 rounded-lg px-2.5 py-2 text-[11px] transition" style={on ? { borderColor: '#8b2e0a', background: '#8b2e0a0d' } : { borderColor: C.border + '40' }}>
                      <span className="font-medium" style={{ color: C.bgChip }}>{a.name}</span><span className="font-bold" style={{ color: C.textPrice }}>{a.price ? '+' + BRL(a.price) : 'grátis'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <input className="w-full rounded-xl px-3 py-2.5 text-xs mt-3 outline-none" style={{ border: `1px solid ${C.border}40`, background: 'white', color: C.bgChip }} placeholder="Observações" value={note} onChange={(e) => setNote(e.target.value)} />

          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-2 rounded-xl px-2" style={{ background: 'white', border: `1px solid ${C.border}40` }}>
              <button className="w-9 h-9 rounded-lg font-bold" style={{ color: C.bgChip }} onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <span className="font-bold text-base w-6 text-center" style={{ color: C.bgChip }}>{qty}</span>
              <button className="w-9 h-9 rounded-lg font-bold" style={{ color: C.bgChip }} onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <button disabled={!valid || !product.available} onClick={() => {
              if (!valid) { alert('Confira as escolhas obrigatórias'); return; }
              cart.add({ key: Math.random().toString(36), productId: product.id, name: product.name, unitPrice: price, qty, note, addons: Object.values(sel).flat() });
              onAdded();
            }} className="flex-1 rounded-xl py-3 text-xs font-bold text-white disabled:opacity-40" style={{ background: '#8b2e0a' }}>Adicionar • {BRL(total)}</button>
          </div>
        </div>
      </div>

          {drinks.length > 0 && (<>
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#8b7a6a' }}>Que tal adicionar?</p>
              <div className="relative">
                <button onClick={() => drinksRef.current?.scrollBy({ left: -150, behavior: 'smooth' })} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md" style={{ background: '#e0d5c8', color: '#3a2010' }}>&lsaquo;</button>
                <div ref={drinksRef} className="flex gap-2 overflow-x-auto scrollbar-hide px-7 pb-1">
                  {drinks.map((d: any) => {
                    const dp = d.promoPrice ?? d.price;
                    return (
                      <button key={d.id} onClick={() => { cart.add({ key: Math.random().toString(36), productId: d.id, name: d.name, unitPrice: dp, qty: 1, note: '', addons: [] }); }} className="flex-shrink-0 w-[120px] rounded-xl p-2 text-center transition hover-addon" style={{ background: 'white', border: '1px solid #d5cab9' }}>
                        <div className="w-10 h-10 mx-auto rounded-lg overflow-hidden mb-1" style={{ background: '#e0d5c8' }}>{d.photoUrl ? <img src={d.photoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-lg">🥤</span>}</div>
                        <p className="text-[9px] font-bold truncate" style={{ color: '#3a2010' }}>{d.name}</p>
                        <p className="text-[9px] font-bold" style={{ color: '#8b5e2a' }}>{BRL(dp)}</p>
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => drinksRef.current?.scrollBy({ left: 150, behavior: 'smooth' })} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md" style={{ background: '#e0d5c8', color: '#3a2010' }}>&rsaquo;</button>
              </div>
            </div>
          </>)}
    </div>
  );
}

/* ======================== CART DRAWER (MOBILE) ======================== */
function CartDrawer({ onClose, onCheckout, products }: any) {
  const cart = useCart();
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center lg:hidden" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto" style={{ background: '#e8d5c0', color: C.bgChip }} onClick={(e) => e.stopPropagation()}>
        <h2 className="font-extrabold text-base" style={{ color: C.bgChip }}>Seu carrinho</h2>
        {cart.items.map((i) => (
          <div key={i.key} className="py-2 text-xs" style={{ borderBottom: `1px solid ${C.border}20` }}>
            <div className="flex justify-between"><b style={{ color: C.bgChip }}>{i.qty}x {i.name}</b><span style={{ color: C.bgChip }}>{BRL(i.qty * (i.unitPrice + i.addons.reduce((s, a) => s + a.price * (a.qty || 1), 0)))}</span></div>
            {i.addons.map((a, k) => <div key={k} style={{ color: C.textMuted }}>• {a.name}</div>)}
            <div className="flex gap-2 mt-0.5">
              <button className="text-[10px] font-bold underline" style={{ color: C.textMuted }} onClick={() => cart.updateQty(i.key, i.qty + 1)}>+1</button>
              <button className="text-[10px] font-bold underline" style={{ color: C.textMuted }} onClick={() => cart.updateQty(i.key, i.qty - 1)}>-1</button>
              <button className="text-[10px] font-bold underline text-red-600" onClick={() => cart.remove(i.key)}>remover</button>
            </div>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <input className="flex-1 rounded-lg px-2.5 py-2 text-[11px] outline-none" style={{ border: `1px solid ${C.border}30`, background: 'white', color: C.bgChip }} placeholder="Cupom" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
          <button className="rounded-lg px-3 text-[11px] font-bold" style={{ background: C.bgChip, color: C.textLight }} onClick={async () => {
            const r = await fetch('/api/coupons/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: coupon, subtotal: cart.subtotal }) }).then((x) => x.json());
            if (!r.ok) alert(r.error); else { setDiscount(r.discount); alert('Cupom aplicado!'); }
          }}>Aplicar</button>
        </div>
        <input className="w-full rounded-lg px-2.5 py-2 text-[11px] mt-2 outline-none" style={{ border: `1px solid ${C.border}30`, background: 'white', color: C.bgChip }} placeholder="Observação" value={cart.note} onChange={(e) => cart.setNote(e.target.value)} />
        <div className="mt-2 text-xs space-y-0.5" style={{ color: C.bgChip }}>
          <div className="flex justify-between"><span style={{ color: C.textMuted }}>Subtotal</span><b>{BRL(cart.subtotal)}</b></div>
          <div className="flex justify-between"><span style={{ color: C.textMuted }}>Desconto</span><b>-{BRL(discount)}</b></div>
          <div className="flex justify-between text-base font-black"><span>Total</span><span style={{ color: '#8b2e0a' }}>{BRL(Math.max(0, cart.subtotal - discount))}</span></div>
        </div>
        <button onClick={() => onCheckout()} className="w-full rounded-xl py-3 font-bold text-white text-xs mt-2" style={{ background: '#8b2e0a' }}>Finalizar • {BRL(Math.max(0, cart.subtotal - discount))}</button>
        <button onClick={onClose} className="w-full text-center text-[10px] mt-1" style={{ color: C.textMuted }}>Continuar comprando</button>
        <CheckoutBridge discount={discount} coupon={coupon} />
      </div>
    </div>
  );
}

function CheckoutBridge({ discount, coupon }: any) {
  useEffect(() => { (window as any).__discount = discount; (window as any).__coupon = coupon; }, [discount, coupon]);
  return null;
}

/* ======================== CHECKOUT ======================== */
function CheckoutModal({ restaurant, onClose }: any) {
  const cart = useCart();
  const [f, setF] = useState({ name: '', phone: '', street: '', number: '', complement: '', district: '', reference: '', type: 'entrega', payment: 'pix', changeFor: '' });
  const [done, setDone] = useState<any>(null);
  const discount = (typeof window !== 'undefined' && (window as any).__discount) || 0;
  const coupon = (typeof window !== 'undefined' && (window as any).__coupon) || '';
  const fee = f.type === 'entrega' ? restaurant.deliveryFee : 0;
  const total = Math.max(0, cart.subtotal + fee - discount);

  const finish = async () => {
    if (!f.name || !f.phone) { alert('Informe nome e telefone'); return; }
    if (f.type === 'entrega' && (!f.street || !f.number)) { alert('Informe endereço de entrega'); return; }
    const addressText = f.type === 'entrega' ? `${f.street}, ${f.number} ${f.complement} - ${f.district} (Ref: ${f.reference})` : f.type === 'retirada' ? 'RETIRADA NO BALCÃO' : 'CONSUMO NO LOCAL';
    const order = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      customerName: f.name, customerPhone: f.phone, street: f.street, number: f.number, complement: f.complement, district: f.district, reference: f.reference,
      addressText, type: f.type, payment: f.payment, changeFor: f.changeFor || null,
      subtotal: cart.subtotal, deliveryFee: fee, discount, couponCode: coupon,
      note: cart.note, items: cart.items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, unitPrice: i.unitPrice, addons: i.addons, note: i.note })),
    })}).then((r) => r.json());
    setDone({ ...order, addressText });
  };

  if (done) {
    const msg = buildWhatsMessage({
      number: done.number, customerName: done.customerName, customerPhone: done.customerPhone,
      items: done.items.map((it: any) => ({ qty: it.qty, name: it.name, addons: JSON.parse(it.addonsJson || '[]') })),
      note: done.note, addressText: done.addressText, payment: done.payment,
      subtotal: done.subtotal, deliveryFee: done.deliveryFee, discount: done.discount, total: done.total,
    });
    const wa = `https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(msg)}`;
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
        <div className="rounded-2xl p-6 max-w-md w-full text-center shadow-2xl" style={{ background: '#e8d5c0', color: C.bgChip }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto text-white" style={{ background: WA_GREEN }}>✅</div>
          <h2 className="text-xl font-black mt-3">Pedido #{done.number}!</h2>
          <p className="text-xs mt-1" style={{ color: C.textMuted }}>Total {BRL(done.total)} • {done.payment.toUpperCase()}</p>
          <pre className="text-left text-[10px] rounded-xl p-3 mt-3 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono" style={{ background: 'white', border: `1px solid ${C.border}20`, color: C.bgChip }}>{msg}</pre>
          <a href={wa} target="_blank" className="block rounded-xl py-3 font-bold text-white text-xs mt-3" style={{ background: WA_GREEN }}>ENVIAR NO WHATSAPP</a>
          <ReviewBox orderId={done.id} />
          <button onClick={() => { cart.clear(); onClose(); }} className="w-full text-[11px] mt-2" style={{ color: C.textMuted }}>Voltar ao cardápio</button>
        </div>
      </div>
    );
  }

  const inp = (k: keyof typeof f, ph: string, extra = '') => (
    <input className={`rounded-lg px-2.5 py-2 text-xs outline-none ${extra}`} style={{ border: `1px solid ${C.border}40`, background: 'white', color: C.bgChip }} placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto shadow-2xl" style={{ background: '#e8d5c0', color: C.bgChip }} onClick={(e) => e.stopPropagation()}>
        <h2 className="font-black text-lg">Finalizar pedido</h2>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {inp('name', 'Nome *')}
          {inp('phone', 'Telefone *')}
          <div className="col-span-2 flex gap-1.5">
            {['entrega', 'retirada', 'local'].map((t) => (
              <button key={t} onClick={() => setF({ ...f, type: t })} className="flex-1 rounded-lg px-2 py-2 text-[11px] font-bold capitalize border-2 transition" style={f.type === t ? { borderColor: '#8b2e0a', background: '#8b2e0a', color: '#fff' } : { borderColor: C.border + '40' }}>{t === 'local' ? 'no local' : t}</button>
            ))}
          </div>
          {f.type === 'entrega' && (<>
            {inp('street', 'Endereço *', 'col-span-2')}
            {inp('number', 'Número *')}
            {inp('complement', 'Compl.')}
            {inp('district', 'Bairro', 'col-span-2')}
            {inp('reference', 'Ref.', 'col-span-2')}
          </>)}
          <div className="col-span-2">
            <p className="text-[10px] font-bold uppercase" style={{ color: C.textMuted }}>Pagamento</p>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {['pix', 'dinheiro', 'debito', 'credito'].map((p) => (
                <button key={p} onClick={() => setF({ ...f, payment: p })} className="rounded-lg px-3 py-2 text-[11px] font-bold capitalize border-2 transition" style={f.payment === p ? { borderColor: '#8b2e0a', background: '#8b2e0a', color: '#fff' } : { borderColor: C.border + '40' }}>{p === 'debito' ? 'débito' : p === 'credito' ? 'crédito' : p}</button>
              ))}
            </div>
            {f.payment === 'dinheiro' && <div className="mt-1.5"><input className="rounded-lg px-2.5 py-2 text-xs w-full outline-none" style={{ border: `1px solid ${C.border}40`, background: 'white', color: C.bgChip }} placeholder="Troco para quanto?" value={f.changeFor} onChange={(e) => setF({ ...f, changeFor: e.target.value })} /></div>}
            {f.payment === 'pix' && <p className="text-[10px] mt-1.5 rounded-lg p-2" style={{ background: 'white', border: `1px solid ${C.border}20` }}>Pix: <b>{restaurant.pixKey}</b></p>}
          </div>
        </div>
        <div className="mt-3 text-xs rounded-lg p-3" style={{ background: 'white', border: `1px solid ${C.border}20` }}>
          <div className="flex justify-between" style={{ color: C.textMuted }}><span>Subtotal</span><span>{BRL(cart.subtotal)}</span></div>
          <div className="flex justify-between" style={{ color: C.textMuted }}><span>Entrega</span><span>{BRL(fee)}</span></div>
          <div className="flex justify-between" style={{ color: C.textMuted }}><span>Desconto</span><span>-{BRL(discount)}</span></div>
          <div className="flex justify-between font-black text-base mt-1 pt-1" style={{ borderTop: `1px solid ${C.border}20`, color: '#8b2e0a' }}><span>Total</span><span>{BRL(total)}</span></div>
        </div>
        <button onClick={finish} className="w-full rounded-xl py-3 font-bold text-white text-xs mt-3" style={{ background: '#8b2e0a' }}>Finalizar • {BRL(total)}</button>
        <button onClick={onClose} className="w-full text-[11px] mt-1" style={{ color: C.textMuted }}>Voltar</button>
      </div>
    </div>
  );
}

function ReviewBox({ orderId }: { orderId: string }) {
  const [stars, setStars] = useState(5);
  const [sent, setSent] = useState(false);
  if (sent) return <p className="text-xs mt-2 font-bold" style={{ color: WA_GREEN }}>Obrigado!</p>;
  return (
    <div className="mt-3 text-xs">
      <div className="flex gap-0.5 justify-center">{[1, 2, 3, 4, 5].map((s) => (
        <button key={s} onClick={() => setStars(s)} className="text-lg">{s <= stars ? '⭐' : '☆'}</button>
      ))}</div>
      <button className="rounded-lg px-3 py-1.5 font-bold w-full mt-1.5" style={{ background: C.bgChip, color: C.textLight }} onClick={async () => {
        await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, stars }) });
        setSent(true);
      }}>Enviar</button>
    </div>
  );
}
