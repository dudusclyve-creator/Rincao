'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/lib/store';
import { BRL, isOpenNow, buildWhatsMessage, showToast, type CartAddon } from '@/lib/utils';

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

const DELIVERY_ZONES_FALLBACK: Record<string, { name: string; fee: number }[]> = {
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
  const [deliveryZones, setDeliveryZones] = useState<Record<string, { name: string; fee: number }[]>>(DELIVERY_ZONES_FALLBACK);

  useEffect(() => { fetch('/api/menu').then((r) => r.json()).then(setData); }, []);
  useEffect(() => {
    const loadAreas = () => {
      fetch('/api/delivery-areas', { cache: 'no-store' }).then((r) => r.json()).then((areas: any[]) => {
        const zones: Record<string, { name: string; fee: number }[]> = {};
        for (const a of areas) {
          if (a.active === false) continue;
          const city = a.city || 'Santana do Livramento';
          if (!zones[city]) zones[city] = [];
          zones[city].push({ name: a.name, fee: a.fee });
        }
        if (Object.keys(zones).length > 0) setDeliveryZones(zones);
      }).catch(() => {});
    };
    loadAreas();
    const t = setInterval(loadAreas, 15000);
    return () => clearInterval(t);
  }, []);

  const selectCat = (id: string) => {
    setCat(id);
    if (tabsRef.current) {
      const tab = tabsRef.current.querySelector(`[data-tab-id='${id}']`) as HTMLElement | null;
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
      <header className="sticky top-0 z-30 backdrop-blur" style={{ background: C.bg + 'f0' }}>
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
                    <button key={p.id} onClick={() => !soldOut && open && setModal(p)} disabled={soldOut || !open} className="flex gap-3 p-2.5 rounded-xl text-left transition disabled:cursor-not-allowed group relative" style={{ background: C.bgCard, border: soldOut ? '2px solid #dc2626' : `1px solid ${C.border}40` }}>
                      <div className="relative w-20 h-20 lg:w-24 lg:h-24 rounded-lg shrink-0" style={{ background: C.bg }}>
                        <div className="w-full h-full rounded-lg overflow-hidden" style={{ filter: soldOut ? 'grayscale(0.5) brightness(0.8)' : 'none' }}>
                          {p.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" /> : <span className="flex items-center justify-center h-full text-3xl" style={{ color: C.textMuted }}>{EMOJI[p.category?.name] || '🍽'}</span>}
                        </div>
                        {p.promoPrice && <span className="absolute top-0 left-0 rounded-br-lg rounded-tl-lg px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-600 z-10">-{Math.round(Math.abs((p.promoPrice - p.price) / p.price) * 100)}%</span>}
                      </div>
                      {soldOut && <span className="absolute top-2.5 left-2.5 rounded-md px-2 py-0.5 text-[9px] font-bold text-white bg-red-600 shadow-lg z-10">Indisponível</span>}
                      <div className="flex-1 min-w-0 flex flex-col justify-between" style={{ opacity: soldOut ? 0.5 : 1 }}>
                        <div>
                          <h3 className="font-bold text-xs lg:text-sm uppercase" style={{ color: C.textName }}>{p.name}</h3>
                          <p className="text-[10px] lg:text-[11px] line-clamp-2 mt-0.5 leading-relaxed" style={{ color: C.textDesc }}>{p.description}</p>
                        </div>
                        <p className="font-extrabold text-sm lg:text-base" style={{ color: p.promoPrice ? '#22c55e' : C.textPrice }}>{BRL(price)} {p.promoPrice && <s className="font-normal text-[10px]" style={{ color: C.textMuted }}>{BRL(p.price)}</s>}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-wrap shrink-0">
                        {p.newArrival && (<span className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: 'linear-gradient(to right, #15803d, #22c55e)' }}>✨ Novidade!</span>)}
                        {p.bestSeller && (
                          <span className="badge-popular inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: 'linear-gradient(to right, #c2410c, #f59e0b)' }}>
                            🔥Popular
                          </span>
                        )}
                        {p.category?.name === 'BEBIDAS' && (
                          <span className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: 'linear-gradient(to right, #0369a1, #38bdf8)' }}>❄️ Gelado</span>
                        )}
                        {p.promoPrice && <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: 'linear-gradient(to right, #b45309, #f59e0b)' }}>Promoção</span>}
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
          <div className="rounded-2xl w-full flex flex-col" style={{ background: 'white', border: '1px solid #f0f0f0', color: '#333', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            {/* Endereço */}
            <button onClick={() => { setAddressOpen(!addressOpen); setDeliveryStep(0); }} className="flex items-center justify-between px-4 py-3 text-left w-full cursor-pointer hover:bg-amber-50/50 transition rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#f5ebe0' }}>
                  <svg className="w-4 h-4" style={{ color: '#6b3a1f' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold" style={{ color: '#3a2515' }}>{deliveryType === 'entrega' && addressText ? addressText : deliveryType === 'retirada' ? 'Retirada no local' : deliveryType === 'local' ? 'Consumo no local' : 'Adicionar endereço'}</p>
                  <p className="text-[10px]" style={{ color: '#b8906a' }}>{deliveryType !== 'entrega' ? 'R$ 0,00' : addressText ? BRL(R.deliveryFee) : 'Defina o endereço'}</p>
                </div>
              </div>
              <svg className="w-4 h-4 shrink-0" style={{ color: '#b8906a', transform: addressOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>

            {/* Itens ou vazio */}
            <div className="overflow-y-auto px-4 py-3">
              {cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2" style={{ background: '#f5ebe0' }}>
                    <svg className="w-7 h-7" style={{ color: '#b8906a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                  </div>
                  <p className="text-[12px] font-medium" style={{ color: '#b8906a' }}>Sacola vazia</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.items.map((i) => {
                    const total = i.qty * (i.unitPrice + i.addons.reduce((s: number, a: CartAddon) => s + a.price * (a.qty || 1), 0));
                    const product = data?.products?.find((p: any) => p.id === i.productId);
                    return (
                      <div key={i.key} className="flex gap-2.5 pb-3" style={{ borderBottom: '1px solid #f0ebe5' }}>
                        {product?.photoUrl && (
                          <img src={product.photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="text-[11px] font-bold flex-1 pr-1" style={{ color: '#3a2515' }}>{i.qty}x {i.name}</p>
                            <span className="text-[11px] font-bold shrink-0" style={{ color: '#3a2515' }}>{BRL(total)}</span>
                          </div>
                          {i.addons.length > 0 && (
                            <div className="mt-0.5">
                              {i.addons.map((a: CartAddon, k: number) => (
                                <p key={k} className="text-[9px]" style={{ color: '#b8906a' }}>+ {a.name}{a.qty && a.qty > 1 ? ` (${a.qty}x)` : ''}</p>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center rounded-lg overflow-hidden" style={{ background: '#f5ebe0' }}>
                              <button className="w-6 h-6 flex items-center justify-center text-xs font-bold" style={{ color: '#6b3a1f' }} onClick={() => cart.updateQty(i.key, i.qty - 1)}>−</button>
                              <span className="w-6 h-6 flex items-center justify-center text-[11px] font-bold" style={{ color: '#3a2515' }}>{i.qty}</span>
                              <button className="w-6 h-6 flex items-center justify-center text-xs font-bold" style={{ color: '#6b3a1f' }} onClick={() => cart.updateQty(i.key, i.qty + 1)}>+</button>
                            </div>
                            <button className="text-[10px]" style={{ color: '#b8906a' }} onClick={() => cart.remove(i.key)}>Remover</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid #f0ebe5' }}>
              {cart.items.length > 0 && (
                <>
                  <button onClick={() => setCheckout(true)} disabled={!open} className="w-full rounded-xl py-3 font-bold text-white text-[13px] transition-all duration-200 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: '#6b3a1f' }}>Finalizar pedido</button>
                  {!open && <p className="text-center text-[10px] mt-1.5 font-semibold" style={{ color: '#dc2626' }}>Estabelecimento fechado no momento</p>}
                </>
              )}
            </div>
          </div>

          {/* Popup de recebimento */}
          {addressOpen && (
            <div className="absolute left-0 right-0 z-30 rounded-xl p-4 shadow-xl" style={{ top: '52px', background: 'white', border: '1px solid #f0f0f0', maxHeight: '420px', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
              {deliveryStep === 0 && (<>
                <p className="text-[9px] font-semibold uppercase tracking-widest mb-2.5 text-gray-400">Como você quer receber?</p>
                <div className="space-y-1.5">
                  {[
                    { id: 'entrega', icon: '🛵', label: 'Entrega', desc: 'A gente leva até você' },
                    { id: 'retirada', icon: '🚶', label: 'Retirada', desc: 'Você retira no local' },
                    { id: 'local', icon: '🏠', label: 'Consumo no local', desc: 'Você consome no local' },
                  ].map((t) => (
                    <button key={t.id} onClick={() => {
                      setDeliveryType(t.id);
                      if (t.id === 'entrega') setDeliveryStep(1);
                      else {
                        setAddressText(t.id === 'retirada' ? 'Retirada no local' : 'Consumo no local');
                        setAddressOpen(false);
                      }
                    }} className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 text-left hover:shadow-sm" style={deliveryType === t.id ? { background: '#6b3a1f', color: '#fff' } : { background: '#f9f9f9', color: '#6b3a1f' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: deliveryType === t.id ? 'rgba(255,255,255,0.15)' : '#fff' }}>{t.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold">{t.label}</p>
                        <p className="text-[9px] opacity-50">{t.desc}</p>
                      </div>
                      <svg className="w-4 h-4 shrink-0 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </button>
                  ))}
                </div>
              </>)}

              {deliveryStep === 1 && (<>
                <button onClick={() => setDeliveryStep(0)} className="flex items-center gap-1 mb-2.5 text-[10px] font-semibold text-gray-400 hover:text-gray-900 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  Voltar
                </button>
                <p className="text-[9px] font-semibold uppercase tracking-widest mb-2.5 text-gray-400">Qual sua cidade?</p>
                <div className="space-y-1.5">
                  {Object.keys(deliveryZones).map((city) => (
                    <button key={city} onClick={() => { setDeliveryCity(city); setDeliveryStep(2); }} className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 text-left hover:shadow-sm" style={{ background: deliveryCity === city ? '#6b3a1f' : '#f9f9f9', color: deliveryCity === city ? '#fff' : '#6b3a1f' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: deliveryCity === city ? 'rgba(255,255,255,0.15)' : '#fff' }}>📍</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold">{city}</p>
                        <p className="text-[9px] opacity-50">{deliveryZones[city].length} bairros</p>
                      </div>
                      <svg className="w-4 h-4 shrink-0 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </button>
                  ))}
                </div>
              </>)}

              {deliveryStep === 2 && (<>
                <button onClick={() => setDeliveryStep(1)} className="flex items-center gap-1 mb-2.5 text-[10px] font-semibold text-gray-400 hover:text-gray-900 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  Voltar
                </button>
                <p className="text-[9px] font-semibold uppercase tracking-widest mb-2.5 text-gray-400">Bairro em {deliveryCity}</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {(deliveryZones[deliveryCity] || []).map((z) => (
                    <button key={z.name} onClick={() => { setDeliveryBairro(z.name); setDeliveryStep(3); }} className="w-full flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 text-left hover:shadow-sm" style={{ background: deliveryBairro === z.name ? '#6b3a1f' : '#f9f9f9', color: deliveryBairro === z.name ? '#fff' : '#6b3a1f' }}>
                      <span className="text-[11px] font-bold">{z.name}</span>
                      <span className="text-[10px] font-bold" style={{ opacity: deliveryBairro === z.name ? 0.7 : 0.4 }}>+{BRL(z.fee)}</span>
                    </button>
                  ))}
                </div>
              </>)}

              {deliveryStep === 3 && (<>
                <button onClick={() => setDeliveryStep(2)} className="flex items-center gap-1 mb-2.5 text-[10px] font-semibold text-gray-400 hover:text-gray-900 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  Voltar
                </button>
                <p className="text-[9px] font-semibold uppercase tracking-widest mb-2.5 text-gray-400">{deliveryBairro}, {deliveryCity}</p>
                <div className="space-y-2">
                  <input className="w-full rounded-xl px-3 py-2.5 text-[11px] outline-none bg-gray-50 border border-gray-200 text-gray-900 focus:border-gray-400 transition-colors" placeholder="Rua *" value={deliveryStreet} onChange={(e) => setDeliveryStreet(e.target.value)} />
                  <div className="flex gap-2">
                    <input className="w-20 shrink-0 rounded-xl px-3 py-2.5 text-[11px] outline-none bg-gray-50 border border-gray-200 text-gray-900 focus:border-gray-400 transition-colors" placeholder="Número *" value={deliveryNum} onChange={(e) => setDeliveryNum(e.target.value)} />
                    <input className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-[11px] outline-none bg-gray-50 border border-gray-200 text-gray-900 focus:border-gray-400 transition-colors" placeholder="Complemento" value={deliveryComp} onChange={(e) => setDeliveryComp(e.target.value)} />
                  </div>
                </div>
                <button onClick={() => {
                  if (!deliveryStreet || !deliveryNum) { showToast('Informe rua e número', 'warning'); return; }
                  const zona = (deliveryZones[deliveryCity] || []).find((z) => z.name === deliveryBairro);
                  const fullAddr = `${deliveryStreet}, ${deliveryNum}${deliveryComp ? ' - ' + deliveryComp : ''} - ${deliveryBairro}, ${deliveryCity}`;
                   setAddressText(fullAddr);
                   setAddressOpen(false);
                }} className="w-full rounded-xl py-2.5 font-bold text-white text-[12px] mt-3 transition-all duration-200 hover:shadow-lg active:scale-[0.98]" style={{ background: '#6b3a1f' }}>Salvar endereço</button>
              </>)}
            </div>
          )}
        </aside>
        </div>
      </div>

      {/* ===== MOBILE CART BAR ===== */}
      {cart.items.length > 0 && !cartOpen && (
        <button onClick={() => open && setCartOpen(true)} disabled={!open} className="lg:hidden fixed bottom-4 inset-x-4 rounded-2xl py-3.5 font-bold text-white shadow-xl z-20 flex items-center justify-between px-5 transition-all duration-200 hover:shadow-2xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: '#6b3a1f' }}>
          <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{totalItems}</span>Ver sacola</span>
          <span>{BRL(cart.subtotal)}</span>
        </button>
      )}

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckout(true); }} products={data.products} deliveryType={deliveryType} setDeliveryType={setDeliveryType} addressText={addressText} setAddressText={setAddressText} deliveryFee={R.deliveryFee} />}
      {checkout && <CheckoutModal restaurant={R} onClose={() => setCheckout(false)} deliveryType={deliveryType} deliveryFee={deliveryType === 'entrega' ? R.deliveryFee : 0} addressText={addressText} />}
      {modal && <ProductModal product={modal} onClose={() => setModal(null)} onAdded={() => setModal(null)} allProducts={data?.products || []} isOpen={open} />}
    </div>
  );
}

/* ======================== PRODUCT MODAL ======================== */
function ProductModal({ product, onClose, onAdded, allProducts, isOpen }: any) {
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
      if (cur.reduce((s, x) => s + (x.qty || 1), 0) + 1 > g.maxSel) { showToast(`Máximo de ${g.maxSel} em "${g.name}"`, 'warning'); return; }
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'white', color: '#333', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
        <div className="relative h-56 overflow-hidden rounded-t-2xl" style={{ background: '#f5f5f5' }}>
          {product.photoUrl
            ? <img src={product.photoUrl} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center text-6xl text-gray-300">{EMOJI[product.category?.name] || '🍽'}</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-sm text-white/70 hover:text-white hover:bg-black/20 transition-all duration-200" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}>✕</button>
          <div className="absolute bottom-4 left-5 right-5">
            <h2 className="text-lg font-bold text-white uppercase tracking-wide">{product.name}</h2>
            <p className="text-xs mt-0.5 text-white/60 leading-relaxed">{product.description}</p>
            <p className="font-bold text-xl mt-1.5 text-white">{BRL(price)} {product.promoPrice && <s className="font-normal text-xs text-white/40">{BRL(product.price)}</s>}</p>
          </div>
        </div>
        <div className="p-5">
          {groups.map((g: any) => (
            <div key={g.id} className="mt-4 rounded-xl p-3.5 bg-gray-50 border border-gray-100">
              <p className="font-semibold text-xs text-gray-900">{g.name} {g.required && <span className="text-red-500">*obrigatório</span>} <span className="text-gray-400">({(sel[g.id] || []).reduce((s: number, x: any) => s + (x.qty || 1), 0)}/{g.maxSel})</span></p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {g.addons?.filter((a: any) => a.active).map((a: any) => {
                  const on = (sel[g.id] || []).some((x) => x.name === a.name);
                  return (
                    <button key={a.id} onClick={() => toggle(g, a)} className="flex justify-between items-center border-2 rounded-xl px-3 py-2.5 text-[11px] transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer" style={on ? { borderColor: '#6b3a1f', background: 'linear-gradient(135deg, #6b3a1f, #8b5e3a)', color: '#fff', boxShadow: '0 4px 14px rgba(107,58,31,0.25)' } : { borderColor: '#e8e0d8', background: '#fdfcfa', color: '#5a4030' }}>
                      <span className="font-medium">{a.name}</span><span className="font-bold text-[10px]" style={{ color: on ? 'rgba(255,255,255,0.8)' : '#b8906a' }}>{a.price ? '+' + BRL(a.price) : 'grátis'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <input className="w-full rounded-xl px-4 py-3 text-xs mt-4 outline-none bg-gray-50 border border-gray-200 text-gray-900 focus:border-gray-400 transition-colors" placeholder="Observações" value={note} onChange={(e) => setNote(e.target.value)} />

          <div className="flex items-center gap-3 mt-5">
            <div className="flex items-center gap-1 rounded-xl overflow-hidden bg-gray-100">
              <button className="w-10 h-10 flex items-center justify-center text-lg font-bold text-gray-400 hover:text-gray-900 transition-all duration-200" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <span className="font-bold text-base w-8 text-center text-gray-900">{qty}</span>
              <button className="w-10 h-10 flex items-center justify-center text-lg font-bold text-gray-400 hover:text-gray-900 transition-all duration-200" onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <button disabled={!valid || !product.available || !isOpen} onClick={() => {
              if (!valid) { showToast('Confira as escolhas obrigatórias', 'warning'); return; }
              cart.add({ key: Math.random().toString(36), productId: product.id, name: product.name, unitPrice: price, qty, note, addons: Object.values(sel).flat() });
              onAdded();
            }} className="flex-1 rounded-xl py-3 text-xs font-bold text-white disabled:opacity-30 transition-all duration-200 hover:shadow-lg active:scale-[0.98]" style={{ background: '#6b3a1f' }}>Adicionar • {BRL(total)}</button>
          </div>
        </div>

        {drinks.length > 0 && (<>
          <div className="px-5 pb-5">
            <div className="pt-4 border-t border-gray-100">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#b8906a' }}>Que tal adicionar?</p>
              <div className="relative">
                <button onClick={() => drinksRef.current?.scrollBy({ left: -200, behavior: 'smooth' })} className="absolute left-0 top-0 bottom-0 z-10 w-10 rounded-xl flex items-center justify-center text-xl font-bold transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur shadow-md" style={{ background: 'rgba(107,58,31,0.1)', color: '#6b3a1f' }}>&lsaquo;</button>
                <div ref={drinksRef} className="flex gap-2.5 overflow-x-auto scrollbar-hide px-11 py-1">
                  {drinks.map((d: any) => {
                    const dp = d.promoPrice ?? d.price;
                    return (
                      <button key={d.id} onClick={() => { cart.add({ key: Math.random().toString(36), productId: d.id, name: d.name, unitPrice: dp, qty: 1, note: '', addons: [] }); }} className="flex-shrink-0 w-[130px] rounded-xl p-2.5 text-center transition-all duration-200 hover:shadow-md active:scale-95 border" style={{ background: '#fdfcfa', borderColor: '#e8e0d8' }}>
                        <div className="w-full h-20 rounded-lg overflow-hidden mb-1.5" style={{ background: '#f0ebe5' }}>{d.photoUrl ? <img src={d.photoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl">🥤</span>}</div>
                        <p className="text-[9px] font-bold truncate" style={{ color: '#5a4030' }}>{d.name}</p>
                        <p className="text-[10px] font-bold" style={{ color: '#b8906a' }}>{BRL(dp)}</p>
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => drinksRef.current?.scrollBy({ left: 200, behavior: 'smooth' })} className="absolute right-0 top-0 bottom-0 z-10 w-10 rounded-xl flex items-center justify-center text-xl font-bold transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur shadow-md" style={{ background: 'rgba(107,58,31,0.1)', color: '#6b3a1f' }}>&rsaquo;</button>
              </div>
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}

/* ======================== CART DRAWER (MOBILE) ======================== */
function CartDrawer({ onClose, onCheckout, products, deliveryType, setDeliveryType, addressText, setAddressText, deliveryFee }: any) {
  const cart = useCart();
  const [step, setStep] = useState(0);
  const [city, setCity] = useState('');
  const [bairro, setBairro] = useState('');
  const [street, setStreet] = useState('');
  const [num, setNum] = useState('');
  const [comp, setComp] = useState('');

  const fee = deliveryType === 'entrega' ? deliveryFee : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center lg:hidden backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto" style={{ background: 'white', color: '#333', boxShadow: '0 -8px 32px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-base" style={{ color: '#3a2515' }}>Seu carrinho</h2>

        {/* Botão de endereço */}
        <button onClick={() => setStep(step === 0 ? 1 : 0)} className="w-full flex items-center gap-2.5 mt-3 p-2.5 rounded-xl transition-all" style={{ background: addressText ? '#f5ebe0' : '#f9f9f9', border: `1px solid ${addressText ? '#e0d0c0' : '#eee'}` }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: addressText ? '#6b3a1f' : '#e0d5c8' }}>
            <svg className="w-4 h-4" style={{ color: addressText ? '#fff' : '#6b3a1f' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-[11px] font-bold" style={{ color: '#3a2515' }}>{deliveryType === 'entrega' && addressText ? addressText : deliveryType === 'retirada' ? 'Retirada no local' : deliveryType === 'local' ? 'Consumo no local' : 'Adicionar endereço'}</p>
            <p className="text-[9px]" style={{ color: '#b8906a' }}>{deliveryType !== 'entrega' ? 'R$ 0,00' : addressText ? BRL(deliveryFee) : 'Defina o endereço'}</p>
          </div>
          <svg className="w-4 h-4 shrink-0" style={{ color: '#b8906a', transform: step !== 0 ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </button>

        {/* Fluxo de endereço mobile */}
        {step === 1 && (
          <div className="mt-2 p-3 rounded-xl" style={{ background: '#fdfcfa', border: '1px solid #e8e0d8' }}>
            <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#b8906a' }}>Como receber?</p>
            <div className="space-y-1.5">
              {[{ id: 'entrega', icon: '🛵', label: 'Entrega' }, { id: 'retirada', icon: '🚶', label: 'Retirada' }, { id: 'local', icon: '🏠', label: 'No local' }].map((t) => (
                <button key={t.id} onClick={() => { setDeliveryType(t.id); if (t.id === 'entrega') setStep(2); else { setAddressText(t.id === 'retirada' ? 'Retirada no local' : 'Consumo no local'); setStep(0); } }} className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all" style={deliveryType === t.id ? { background: '#6b3a1f', color: '#fff' } : { background: '#f5ebe0', color: '#5a4030' }}>
                  <span className="text-sm">{t.icon}</span>
                  <span className="text-[11px] font-bold">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-2 p-3 rounded-xl" style={{ background: '#fdfcfa', border: '1px solid #e8e0d8' }}>
            <button onClick={() => setStep(1)} className="text-[10px] font-semibold mb-2" style={{ color: '#6b3a1f' }}>← Voltar</button>
            <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#b8906a' }}>Cidade</p>
            <div className="space-y-1.5">
              {Object.keys(deliveryZones).map((c) => (
                <button key={c} onClick={() => { setCity(c); setStep(3); }} className="w-full flex items-center justify-between p-2 rounded-lg text-left" style={{ background: city === c ? '#6b3a1f' : '#f5ebe0', color: city === c ? '#fff' : '#5a4030' }}>
                  <span className="text-[11px] font-bold">{c}</span>
                  <span className="text-[9px]">{deliveryZones[c].length} bairros</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-2 p-3 rounded-xl" style={{ background: '#fdfcfa', border: '1px solid #e8e0d8' }}>
            <button onClick={() => setStep(2)} className="text-[10px] font-semibold mb-2" style={{ color: '#6b3a1f' }}>← Voltar</button>
            <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#b8906a' }}>Bairro em {city}</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {(deliveryZones[city] || []).map((z) => (
                <button key={z.name} onClick={() => { setBairro(z.name); setStep(4); }} className="w-full flex items-center justify-between p-2 rounded-lg text-left" style={{ background: bairro === z.name ? '#6b3a1f' : '#f5ebe0', color: bairro === z.name ? '#fff' : '#5a4030' }}>
                  <span className="text-[11px] font-bold">{z.name}</span>
                  <span className="text-[10px] font-bold">+{BRL(z.fee)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-2 p-3 rounded-xl" style={{ background: '#fdfcfa', border: '1px solid #e8e0d8' }}>
            <button onClick={() => setStep(3)} className="text-[10px] font-semibold mb-2" style={{ color: '#6b3a1f' }}>← Voltar</button>
            <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#b8906a' }}>{bairro}, {city}</p>
            <div className="space-y-2">
              <input className="w-full rounded-lg px-3 py-2 text-[11px] outline-none" style={{ border: '1px solid #e8e0d8', background: 'white', color: '#333' }} placeholder="Rua *" value={street} onChange={(e) => setStreet(e.target.value)} />
              <div className="flex gap-2">
                <input className="w-20 shrink-0 rounded-lg px-3 py-2 text-[11px] outline-none" style={{ border: '1px solid #e8e0d8', background: 'white', color: '#333' }} placeholder="Nº *" value={num} onChange={(e) => setNum(e.target.value)} />
                <input className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[11px] outline-none" style={{ border: '1px solid #e8e0d8', background: 'white', color: '#333' }} placeholder="Compl." value={comp} onChange={(e) => setComp(e.target.value)} />
              </div>
            </div>
            <button onClick={() => {
              if (!street || !num) { showToast('Informe rua e número', 'warning'); return; }
              setAddressText(`${street}, ${num}${comp ? ' - ' + comp : ''} - ${bairro}, ${city}`);
              setStep(0);
            }} className="w-full rounded-lg py-2 font-bold text-white text-[11px] mt-2" style={{ background: '#6b3a1f' }}>Salvar</button>
          </div>
        )}

        {cart.items.map((i) => (
          <div key={i.key} className="py-2.5 text-xs" style={{ borderBottom: '1px solid #f0ebe5' }}>
            <div className="flex justify-between"><b style={{ color: '#3a2515' }}>{i.qty}x {i.name}</b><span style={{ color: '#3a2515' }}>{BRL(i.qty * (i.unitPrice + i.addons.reduce((s, a) => s + a.price * (a.qty || 1), 0)))}</span></div>
            {i.addons.map((a, k) => <div key={k} style={{ color: '#b8906a' }}>• {a.name}</div>)}
            <div className="flex gap-3 mt-1">
              <button className="text-[10px] font-semibold" style={{ color: '#b8906a' }} onClick={() => cart.updateQty(i.key, i.qty + 1)}>+1</button>
              <button className="text-[10px] font-semibold" style={{ color: '#b8906a' }} onClick={() => cart.updateQty(i.key, i.qty - 1)}>-1</button>
              <button className="text-[10px] font-semibold text-red-500" onClick={() => cart.remove(i.key)}>remover</button>
            </div>
          </div>
        ))}
        <input className="w-full rounded-xl px-3 py-2.5 text-[11px] mt-2 outline-none" style={{ border: '1px solid #e8e0d8', background: '#fdfcfa', color: '#333' }} placeholder="Observação" value={cart.note} onChange={(e) => cart.setNote(e.target.value)} />
        <div className="mt-3 text-xs space-y-1">
          <div className="flex justify-between" style={{ color: '#b8906a' }}><span>Subtotal</span><span style={{ color: '#5a4030' }}>{BRL(cart.subtotal)}</span></div>
          {fee > 0 && <div className="flex justify-between" style={{ color: '#b8906a' }}><span>Entrega</span><span style={{ color: '#5a4030' }}>{BRL(fee)}</span></div>}
          <div className="flex justify-between text-base font-bold pt-1" style={{ color: '#3a2515', borderTop: '1px solid #f0ebe5' }}><span>Total</span><span>{BRL(Math.max(0, cart.subtotal + fee))}</span></div>
        </div>
        <button onClick={() => onCheckout()} className="w-full rounded-xl py-3 font-bold text-white text-xs mt-3 transition-all duration-200 hover:shadow-lg active:scale-[0.98]" style={{ background: '#6b3a1f' }}>Finalizar • {BRL(Math.max(0, cart.subtotal + fee))}</button>
        <button onClick={onClose} className="w-full text-center text-[10px] mt-2" style={{ color: '#b8906a' }}>Continuar comprando</button>
      </div>
    </div>
  );
}

/* ======================== CHECKOUT ======================== */
function CheckoutModal({ restaurant, onClose, deliveryType, deliveryFee, addressText }: any) {
  const cart = useCart();
  const [f, setF] = useState({ name: '', phone: '', payment: 'pix', changeFor: '' });
  const [done, setDone] = useState<any>(null);
  const fee = deliveryType === 'entrega' ? deliveryFee : 0;
  const total = Math.max(0, cart.subtotal + fee);

  const parseAddress = (text: string) => {
    if (!text) return { street: '', number: '', complement: '', district: '' };
    const match = text.match(/^(.+?),\s*(\S+?)(?:\s*-\s*(.+?))?\s*-\s*(.+)$/);
    if (match) return { street: match[1].trim(), number: match[2].trim(), complement: match[3]?.trim() || '', district: match[4].trim() };
    return { street: text, number: '', complement: '', district: '' };
  };

  const addr = parseAddress(addressText);

  const finish = async () => {
    if (!f.name || !f.phone) { showToast('Informe nome e telefone', 'warning'); return; }
    if (deliveryType === 'entrega' && restaurant.minOrder && cart.subtotal < restaurant.minOrder) {
      showToast(`Pedido mínimo: ${BRL(restaurant.minOrder)}`, 'warning'); return;
    }
    const order = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      customerName: f.name, customerPhone: f.phone, street: addr.street, number: addr.number, complement: addr.complement, district: addr.district, reference: '',
      addressText: addressText || (deliveryType === 'retirada' ? 'RETIRADA NO BALCÃO' : 'CONSUMO NO LOCAL'),
      type: deliveryType, payment: f.payment, changeFor: f.changeFor || null,
      subtotal: cart.subtotal, deliveryFee: fee, discount: 0, couponCode: '',
      note: cart.note, items: cart.items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, unitPrice: i.unitPrice, addons: i.addons, note: i.note })),
    })}).then((r) => r.json());
    setDone({ ...order, addressText: addressText || (deliveryType === 'retirada' ? 'RETIRADA NO BALCÃO' : 'CONSUMO NO LOCAL') });
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
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="rounded-2xl p-6 max-w-md w-full text-center" style={{ background: 'white', color: '#333', boxShadow: '0 25px 60px rgba(0,0,0,0.1)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto bg-green-50">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mt-3">Pedido #{done.number}!</h2>
          <p className="text-xs mt-1 text-gray-400">Total {BRL(done.total)} • {done.payment.toUpperCase()}</p>
          <pre className="text-left text-[10px] rounded-xl p-3 mt-3 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono bg-gray-50 border border-gray-100 text-gray-700">{msg}</pre>
          <a href={wa} target="_blank" className="block rounded-xl py-3 font-bold text-white text-xs mt-3 transition-all duration-200 hover:shadow-lg active:scale-[0.98]" style={{ background: WA_GREEN }}>ENVIAR NO WHATSAPP</a>
          <button onClick={() => { cart.clear(); onClose(); }} className="w-full text-[11px] mt-2 text-gray-400 hover:text-gray-600 transition-colors">Voltar ao cardápio</button>
        </div>
      </div>
    );
  }

  const change = f.payment === 'dinheiro' && f.changeFor ? Math.max(0, parseFloat(f.changeFor.replace(',', '.')) - total) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'white', color: '#333', boxShadow: '0 25px 60px rgba(0,0,0,0.12)' }} onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Finalizar pedido</h2>
              <p className="text-[11px] mt-0.5 text-gray-400">{deliveryType === 'entrega' ? '🛵 Entrega' : deliveryType === 'retirada' ? '🚶 Retirada' : '🏠 No local'}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200">✕</button>
          </div>

          <div className="space-y-2.5">
            <input className="w-full rounded-xl px-4 py-3 text-sm outline-none bg-gray-50 border border-gray-200 text-gray-900 focus:border-gray-400 transition-colors" placeholder="Seu nome *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className="w-full rounded-xl px-4 py-3 text-sm outline-none bg-gray-50 border border-gray-200 text-gray-900 focus:border-gray-400 transition-colors" placeholder="Telefone *" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5 text-gray-400">Pagamento</p>
            <div className="grid grid-cols-4 gap-2">
              {[{ id: 'pix', icon: '📱', label: 'Pix' }, { id: 'dinheiro', icon: '💵', label: 'Dinheiro' }, { id: 'debito', icon: '💳', label: 'Débito' }, { id: 'credito', icon: '💳', label: 'Crédito' }].map((p) => (
                <button key={p.id} onClick={() => setF({ ...f, payment: p.id })} className="flex flex-col items-center gap-1.5 rounded-xl py-3 text-[10px] font-semibold transition-all duration-200 border" style={f.payment === p.id ? { borderColor: '#6b3a1f', background: '#6b3a1f', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } : { borderColor: '#f0f0f0', background: '#f9f9f9', color: '#888' }}>
                  <span className="text-base">{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {f.payment === 'dinheiro' && (
            <div className="mt-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
              <input type="number" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none bg-white border border-gray-200 text-gray-900 focus:border-gray-400 transition-colors" placeholder="Troco para quanto?" value={f.changeFor} onChange={(e) => setF({ ...f, changeFor: e.target.value })} />
              {f.changeFor && parseFloat(f.changeFor.replace(',', '.')) > 0 && (
                <div className="flex items-center gap-2 mt-2.5 p-2.5 rounded-lg" style={{ background: change >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${change >= 0 ? '#dcfce7' : '#fecaca'}` }}>
                  <span className="text-sm">{change >= 0 ? '✅' : '❌'}</span>
                  <p className="text-xs font-semibold" style={{ color: change >= 0 ? '#16a34a' : '#dc2626' }}>
                    {change >= 0 ? `Troco: ${BRL(change)}` : `Faltam ${BRL(Math.abs(change))}`}
                  </p>
                </div>
              )}
            </div>
          )}

          {f.payment === 'pix' && (
            <div className="mt-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Chave Pix</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{restaurant.pixKey}</p>
            </div>
          )}

          <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
            {deliveryType === 'entrega' && restaurant.minOrder > 0 && cart.subtotal < restaurant.minOrder && (
              <div className="mb-2 p-2 rounded-lg text-[11px] font-bold text-center" style={{ background: '#fef2f2', color: '#dc2626' }}>
                Pedido mínimo para entrega: {BRL(restaurant.minOrder)} · Faltam {BRL(restaurant.minOrder - cart.subtotal)}
              </div>
            )}
            <div className="flex justify-between text-xs mb-1.5 text-gray-400"><span>Subtotal</span><span className="text-gray-700">{BRL(cart.subtotal)}</span></div>
            {fee > 0 && <div className="flex justify-between text-xs mb-1.5 text-gray-400"><span>Entrega</span><span className="text-gray-700">{BRL(fee)}</span></div>}
            <div className="flex justify-between items-center text-base font-bold text-gray-900 mt-2.5 pt-2.5 border-t border-gray-200">
              <span>Total</span>
              <span className="text-xl">{BRL(total)}</span>
            </div>
          </div>

          {(() => {
            const minOk = deliveryType !== 'entrega' || !restaurant.minOrder || cart.subtotal >= restaurant.minOrder;
            return <button onClick={finish} disabled={!minOk} className="w-full rounded-xl py-3.5 font-bold text-white text-sm mt-5 transition-all duration-200 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: minOk ? '#6b3a1f' : '#9ca3af' }}>Finalizar • {BRL(total)}</button>;
          })()}
          <button onClick={onClose} className="w-full text-center text-[11px] mt-3 py-1 text-gray-400 hover:text-gray-600 transition-colors">Voltar</button>
        </div>
      </div>
    </div>
  );
}


