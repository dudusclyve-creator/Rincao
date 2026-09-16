'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { BRL } from '@/lib/utils';
import {
  ChevronDown, ChevronRight, Plus, Trash2, Pencil,
  Copy, Eye, EyeOff, ChevronUp, Package, Star, Flame, X, Check,
  ArrowUp, ArrowDown,
} from 'lucide-react';

const GRID = '14px 32px 1fr 90px auto auto';

/* ══════════ IMAGE UPLOAD ══════════ */
function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const fd = new window.FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.url) onChange(d.url);
    } finally { setUploading(false); }
  };
  return (
    <div className="flex items-center gap-2">
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      {value ? (
        <div className="relative group w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shrink-0 cursor-pointer" onClick={() => ref.current?.click()}>
          <img src={value} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="text-white text-[10px] font-bold">Trocar</span></div>
          {uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white text-[10px]">...</span></div>}
        </div>
      ) : (
        <button onClick={() => ref.current?.click()} className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 hover:border-amber-400 flex items-center justify-center text-gray-400 hover:text-amber-500 transition-colors shrink-0" disabled={uploading}>
          {uploading ? <span className="text-[10px]">...</span> : <span className="text-lg leading-none">+</span>}
        </button>
      )}
      <input className="input flex-1 text-xs" placeholder="Ou cole a URL da foto" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ══════════ MAIN ══════════ */
export default function CardapioAdmin() {
  const [cats, setCats] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [addonGroups, setAddonGroups] = useState<any[]>([]);
  const [groupsList, setGroupsList] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newCatName, setNewCatName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [np, setNp] = useState({ name: '', price: '', promoPrice: '', description: '', photoUrl: '', categoryId: '', groupIds: [] as string[], available: true, featured: false, bestSeller: false, newArrival: false });
  const [showAddons, setShowAddons] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [addonInputs, setAddonInputs] = useState<Record<string, { name: string; price: string }>>({});
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingAddon, setEditingAddon] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [groupEditForm, setGroupEditForm] = useState({ name: '', minSel: 0, maxSel: 2, required: false });
  const [addonEditForm, setAddonEditForm] = useState({ name: '', price: 0 });
  const [productEditForm, setProductEditForm] = useState({ name: '', price: '', promoPrice: '', description: '', photoUrl: '', categoryId: '', available: true, featured: false, bestSeller: false, newArrival: false, groupIds: [] as string[] });
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMin, setNewGroupMin] = useState(0);
  const [newGroupMax, setNewGroupMax] = useState(2);

  const load = async () => {
    const [c, p, g] = await Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/products').then((r) => r.json()),
      fetch('/api/addon-groups').then((r) => r.json()),
    ]);
    setCats(c); setProducts(p); setAddonGroups(g); setGroupsList(g);
  };
  useEffect(() => { load(); }, []);

  const productsByCat = useMemo(() => {
    const m: Record<string, any[]> = {};
    cats.forEach((c) => { m[c.id] = products.filter((p) => p.categoryId === c.id).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)); });
    return m;
  }, [cats, products]);

  const expandAll = () => { const m: Record<string, boolean> = {}; cats.forEach((c) => { m[c.id] = true; }); setExpanded(m); };
  const collapseAll = () => setExpanded({});
  const toggleCat = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCatName, order: cats.length }) });
    setNewCatName(''); load();
  };
  const renameCategory = async (id: string, oldName: string) => {
    const name = prompt('Nome da categoria:', oldName);
    if (name && name !== oldName) { await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) }); load(); }
  };
  const deleteCategory = async (id: string) => {
    if (confirm('Excluir categoria e todos os produtos?')) { await fetch(`/api/categories?id=${id}`, { method: 'DELETE' }); load(); }
  };

  const createProduct = async () => {
    if (!np.name || !np.price || !np.categoryId) return;
    await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...np, price: Number(np.price), promoPrice: np.promoPrice ? Number(np.promoPrice) : null, order: productsByCat[np.categoryId]?.length || 0 }) });
    setNp({ name: '', price: '', promoPrice: '', description: '', photoUrl: '', categoryId: '', groupIds: [], available: true, featured: false, bestSeller: false, newArrival: false });
    setShowNew(false); load();
  };

  const updateProduct = async (id: string, data: any) => {
    await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...data }) });
    load();
  };

  const moveProduct = async (id: string, catId: string, dir: -1 | 1) => {
    const prods = (productsByCat[catId] || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    const idx = prods.findIndex((p: any) => p.id === id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= prods.length) return;
    const a = prods[idx], b = prods[targetIdx];
    await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, order: b.order ?? 0 }) });
    await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, order: a.order ?? 0 }) });
    load();
  };

  const moveCategory = async (id: string, dir: -1 | 1) => {
    const idx = cats.findIndex((c) => c.id === id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= cats.length) return;
    const a = cats[idx], b = cats[targetIdx];
    await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, order: b.order ?? 0 }) });
    await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, order: a.order ?? 0 }) });
    load();
  };

  const createAddonGroup = async () => {
    if (!newGroupName.trim()) return;
    await fetch('/api/addon-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newGroupName, minSel: newGroupMin, maxSel: newGroupMax, order: addonGroups.length }) });
    setNewGroupName(''); setNewGroupMin(0); setNewGroupMax(2); load();
  };
  const saveAddon = async (groupId: string, name: string, price: number) => {
    const g = addonGroups.find((x) => x.id === groupId);
    await fetch('/api/addon-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId, addon: { name, price, order: g?.addons?.length || 0 } }) });
    load();
  };
  const deleteAddon = async (id: string) => { await fetch(`/api/addon-groups?addonId=${id}`, { method: 'DELETE' }); load(); };
  const saveGroupEdit = async (id: string) => {
    await fetch('/api/addon-groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: groupEditForm.name, minSel: groupEditForm.minSel, maxSel: groupEditForm.maxSel, required: groupEditForm.required }) });
    setEditingGroup(null);
    load();
  };
  const saveAddonEdit = async (addonId: string) => {
    await fetch('/api/addon-groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addonId, name: addonEditForm.name, price: addonEditForm.price }) });
    setEditingAddon(null);
    load();
  };
  const deleteAddonGroup = async (id: string) => { if (confirm('Excluir grupo e todos os adicionais?')) { await fetch(`/api/addon-groups?id=${id}`, { method: 'DELETE' }); load(); } };

  const moveAddonGroup = async (id: string, dir: -1 | 1) => {
    const idx = addonGroups.findIndex((g) => g.id === id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= addonGroups.length) return;
    const a = addonGroups[idx], b = addonGroups[targetIdx];
    await fetch('/api/addon-groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, order: b.order ?? 0 }) });
    await fetch('/api/addon-groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, order: a.order ?? 0 }) });
    load();
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Cardápio</h1>
          <p className="text-sm text-gray-400 mt-0.5">Categorias, produtos e adicionais do seu cardápio.</p>
        </div>
      </div>

      {/* HEADER ACTIONS */}
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => { setShowNew(!showNew); if (!showNew && cats.length > 0 && !np.categoryId) setNp({ ...np, categoryId: cats[0].id }); }} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors">
          <Plus size={15} /> Novo Produto
        </button>
        <button onClick={() => { const allOpen = cats.every((c) => expanded[c.id]); allOpen ? collapseAll() : expandAll(); }} className="bg-white border border-gray-200 hover:border-gray-300 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1 transition-colors">{cats.every((c) => expanded[c.id]) ? <><ChevronUp size={13} /> Recolher tudo</> : <><ChevronDown size={13} /> Abrir tudo</>}</button>
        <div className="flex-1" />
        <div className="flex gap-2 items-center">
          <input className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-100 outline-none w-48 transition-all" placeholder="Nova categoria..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createCategory()} />
          <button onClick={createCategory} className="bg-white border border-gray-200 hover:border-amber-300 text-gray-600 hover:text-amber-600 text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"><Plus size={14} /> Categoria</button>
        </div>
      </div>

      {/* NEW PRODUCT FORM */}
      {showNew && (
        <div className="rounded-xl border border-amber-200 bg-white p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Novo Produto</h3>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="input w-full" placeholder="Nome *" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
            <input className="input w-full" placeholder="Preço *" type="number" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} />
            <input className="input w-full" placeholder="Preço promo" type="number" value={np.promoPrice || ''} onChange={(e) => setNp({ ...np, promoPrice: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select className="input w-full" value={np.categoryId} onChange={(e) => setNp({ ...np, categoryId: e.target.value })}><option value="">Categoria *</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input className="input w-full" placeholder="Descrição" value={np.description || ''} onChange={(e) => setNp({ ...np, description: e.target.value })} />
            <ImageUpload value={np.photoUrl || ''} onChange={(url) => setNp({ ...np, photoUrl: url })} />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {groupsList.map((g) => (
              <label key={g.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 cursor-pointer hover:border-amber-300 transition-colors">
                <input type="checkbox" className="accent-amber-500 scale-90" checked={np.groupIds.includes(g.id)} onChange={(e) => setNp({ ...np, groupIds: e.target.checked ? [...np.groupIds, g.id] : np.groupIds.filter((x) => x !== g.id) })} />
                <span className="text-xs text-gray-600">{g.name}</span>
              </label>
            ))}
            <div className="flex-1" />
            {['featured', 'bestSeller', 'newArrival', 'available'].map((k) => (
              <label key={k} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" className="accent-amber-500 scale-90" checked={k === 'available' ? (np.available ?? true) : !!np[k as keyof typeof np]} onChange={(e) => setNp({ ...np, [k]: e.target.checked })} />
                <span className="text-xs text-gray-500">{k === 'featured' ? '⭐ Destaque' : k === 'bestSeller' ? '🔥 Popular' : k === 'newArrival' ? '✨ Novidade' : '👁 Ativo'}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors" onClick={createProduct}><Check size={14} /> Criar Produto</button>
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => setShowNew(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* CATEGORIES + PRODUCTS */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-amber-500 rounded-full" />
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categorias & Produtos</h2>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{cats.length} categorias · {products.length} produtos</span>
        </div>

        {cats.map((cat) => {
          const prods = productsByCat[cat.id] || [];
          const isOpen = !!expanded[cat.id];
          const catIdx = cats.indexOf(cat);
          return (
            <div key={cat.id} className="mb-2">
              {/* CATEGORY ROW */}
              <div className="rounded-xl border border-gray-200 bg-white hover:shadow-sm transition-all overflow-hidden">
                <div className="grid items-center gap-3 px-3 py-2" style={{ gridTemplateColumns: GRID }}>
                  <div className="flex items-center justify-center gap-0.5">
                    <button onClick={() => moveCategory(cat.id, -1)} disabled={catIdx === 0} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-600 transition-colors" title="Mover para cima"><ArrowUp size={12} /></button>
                    <button onClick={() => moveCategory(cat.id, 1)} disabled={catIdx === cats.length - 1} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-600 transition-colors" title="Mover para baixo"><ArrowDown size={12} /></button>
                  </div>
                  <div className="w-1 h-7 bg-amber-400 rounded-full shrink-0" />
                  <div className="min-w-0 flex items-center gap-2">
                    <button onClick={() => toggleCat(cat.id)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-gray-800 block">{cat.name}</span>
                      <span className="text-[10px] text-gray-400">{prods.length} produtos</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-center shrink-0">{prods.length}</span>
                  <div className="w-px h-5 bg-gray-200 justify-self-center" />
                  <div className="flex items-center gap-0.5 justify-self-end">
                    <button onClick={() => renameCategory(cat.id, cat.name)} className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors" title="Renomear"><Pencil size={13} /></button>
                    <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>

              {/* PRODUCTS INSIDE */}
              {isOpen && (
                <div className="ml-7 mt-1 mb-1 space-y-0.5 rounded-xl border border-gray-100 bg-gray-50/50 p-1.5">
                  {prods.map((p: any) => {
                    const pIdx = prods.indexOf(p);
                    return (
                      <div key={p.id}>
                        {/* Product display row */}
                        <div className="bg-white rounded-lg border border-gray-100 mb-0.5">
                          <div className="grid items-center gap-3 px-3 py-2" style={{ gridTemplateColumns: GRID }}>
                            <div className="flex items-center justify-center gap-0.5">
                              <button onClick={() => moveProduct(p.id, cat.id, -1)} disabled={pIdx === 0} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-600 transition-colors" title="Mover para cima"><ArrowUp size={12} /></button>
                              <button onClick={() => moveProduct(p.id, cat.id, 1)} disabled={pIdx === prods.length - 1} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-600 transition-colors" title="Mover para baixo"><ArrowDown size={12} /></button>
                            </div>
                            {p.photoUrl
                              ? <img src={p.photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                              : <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center"><Package size={14} className="text-gray-400" /></div>
                            }
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="truncate text-sm text-gray-700">{p.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {p.featured && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium border border-amber-100"><Star size={8} className="inline mr-0.5" />Destaque</span>}
                                {p.bestSeller && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-medium border border-red-100"><Flame size={8} className="inline mr-0.5" />Popular</span>}
                                {!p.available && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full border border-gray-200">Off</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 justify-end shrink-0">
                              {p.promoPrice && <span className="text-xs text-gray-400 line-through">{BRL(p.price)}</span>}
                              <span className={`text-sm font-semibold ${p.promoPrice ? 'text-emerald-600' : 'text-amber-700'}`}>{BRL(p.promoPrice ?? p.price)}</span>
                            </div>
                            <div className="w-px h-5 bg-gray-200 justify-self-center" />
                            <div className="flex items-center gap-0.5 justify-self-end">
                              <button onClick={() => { setEditingProduct(editingProduct === p.id ? null : p.id); setProductEditForm({ name: p.name, price: String(p.price), promoPrice: p.promoPrice ? String(p.promoPrice) : '', description: p.description || '', photoUrl: p.photoUrl || '', categoryId: p.categoryId, available: p.available, featured: p.featured, bestSeller: p.bestSeller, newArrival: p.newArrival, groupIds: p.groups?.map((g: any) => g.groupId) || [] }); }} className={`p-1.5 rounded-md transition-colors ${editingProduct === p.id ? 'bg-blue-50 text-blue-500' : 'hover:bg-blue-50 text-blue-500'}`} title="Editar"><Pencil size={13} /></button>
                              <button onClick={() => { fetch(`/api/products?id=${p.id}&duplicate=1`, { method: 'DELETE' }); load(); }} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Duplicar"><Copy size={13} /></button>
                              <button onClick={() => { fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, available: !p.available }) }); load(); }} className={`p-1.5 rounded-md transition-colors ${p.available ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-gray-100 text-gray-300'}`} title={p.available ? 'Desativar' : 'Ativar'}>{p.available ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                              <button onClick={() => { if (confirm('Excluir?')) { fetch(`/api/products?id=${p.id}`, { method: 'DELETE' }); load(); } }} className="p-1.5 rounded-md hover:bg-red-50 text-red-400 transition-colors" title="Excluir"><Trash2 size={13} /></button>
                            </div>
                          </div>
                        </div>

                        {/* Product edit form - SEPARATE DIV below */}
                        {editingProduct === p.id && (
                          <div className="bg-white rounded-lg border border-amber-200 p-3 space-y-2 mb-0.5">
                            <div className="grid grid-cols-3 gap-2">
                              <input className="input w-full" placeholder="Nome *" value={productEditForm.name} onChange={(e) => setProductEditForm({ ...productEditForm, name: e.target.value })} />
                              <input className="input w-full" placeholder="Preço *" type="number" value={productEditForm.price} onChange={(e) => setProductEditForm({ ...productEditForm, price: e.target.value })} />
                              <input className="input w-full" placeholder="Preço promo" type="number" value={productEditForm.promoPrice || ''} onChange={(e) => setProductEditForm({ ...productEditForm, promoPrice: e.target.value })} />
                            </div>
                            <input className="input w-full" placeholder="Descrição" value={productEditForm.description || ''} onChange={(e) => setProductEditForm({ ...productEditForm, description: e.target.value })} />
                            <div className="grid grid-cols-2 gap-2">
                              <ImageUpload value={productEditForm.photoUrl || ''} onChange={(url) => setProductEditForm({ ...productEditForm, photoUrl: url })} />
                              <select className="input w-full" value={productEditForm.categoryId} onChange={(e) => setProductEditForm({ ...productEditForm, categoryId: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              {groupsList.map((g) => (
                                <label key={g.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 cursor-pointer hover:border-amber-300 transition-colors">
                                  <input type="checkbox" className="accent-amber-500 scale-90" checked={productEditForm.groupIds.includes(g.id)} onChange={(e) => setProductEditForm({ ...productEditForm, groupIds: e.target.checked ? [...productEditForm.groupIds, g.id] : productEditForm.groupIds.filter((x: string) => x !== g.id) })} />
                                  <span className="text-xs text-gray-600">{g.name}</span>
                                </label>
                              ))}
                            </div>
                            <div className="flex gap-2 items-center pt-2 border-t border-gray-100">
                              {['featured', 'bestSeller', 'newArrival', 'available'].map((k) => (
                                <label key={k} className="flex items-center gap-1 cursor-pointer">
                                  <input type="checkbox" className="accent-amber-500 scale-90" checked={k === 'available' ? (productEditForm.available ?? true) : !!productEditForm[k as keyof typeof productEditForm]} onChange={(e) => setProductEditForm({ ...productEditForm, [k]: e.target.checked })} />
                                  <span className="text-xs text-gray-500">{k === 'featured' ? '⭐ Destaque' : k === 'bestSeller' ? '🔥 Popular' : k === 'newArrival' ? '✨ Novidade' : '👁 Ativo'}</span>
                                </label>
                              ))}
                              <div className="flex-1" />
                              <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center gap-1 transition-colors" onClick={() => { updateProduct(p.id, { ...productEditForm, price: Number(productEditForm.price), promoPrice: productEditForm.promoPrice ? Number(productEditForm.promoPrice) : null }); setEditingProduct(null); }}><Check size={13} /> Salvar</button>
                              <button className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg transition-colors" onClick={() => setEditingProduct(null)}>Cancelar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {prods.length === 0 && <p className="text-xs text-gray-400 py-3 text-center italic">Nenhum produto nesta categoria</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ADDON GROUPS */}
      <div>
        <button onClick={() => setShowAddons(!showAddons)} className="flex items-center gap-2 group mb-2">
          <div className="w-1 h-4 bg-blue-400 rounded-full" />
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors">Adicionais</h2>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{addonGroups.length} grupos</span>
          <span className="text-gray-400 group-hover:text-gray-600 transition-colors">{showAddons ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
        </button>

        {showAddons && (
          <div className="space-y-2">
            <div className="grid gap-2 items-center mb-3" style={{ gridTemplateColumns: '1fr 56px 56px auto' }}>
              <input className="input" placeholder="Nome do grupo (ex: Molhos, Bebidas...)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAddonGroup()} />
              <input className="input text-center" type="number" placeholder="Mín" value={newGroupMin} onChange={(e) => setNewGroupMin(Number(e.target.value))} />
              <input className="input text-center" type="number" placeholder="Máx" value={newGroupMax} onChange={(e) => setNewGroupMax(Number(e.target.value))} />
              <button onClick={createAddonGroup} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"><Plus size={14} /> Grupo</button>
            </div>

            {addonGroups.map((gr) => {
              const isGroupOpen = !!expandedGroups[gr.id];
              const grIdx = addonGroups.indexOf(gr);
              const isEditingGroup = editingGroup === gr.id;
              return (
                <div key={gr.id} className="rounded-xl border border-gray-200 bg-white">
                  {/* Group display row - ALWAYS shown */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="flex items-center justify-center gap-0.5 shrink-0">
                      <button onClick={() => moveAddonGroup(gr.id, -1)} disabled={grIdx === 0} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-600 transition-colors" title="Mover para cima"><ArrowUp size={12} /></button>
                      <button onClick={() => moveAddonGroup(gr.id, 1)} disabled={grIdx === addonGroups.length - 1} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-600 transition-colors" title="Mover para baixo"><ArrowDown size={12} /></button>
                    </div>
                    <div className="w-1 h-6 bg-blue-400 rounded-full shrink-0" />
                    <button onClick={() => setExpandedGroups((p) => ({ ...p, [gr.id]: !p[gr.id] }))} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">{isGroupOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                    <span className="text-sm font-semibold text-gray-800 truncate flex-1">{gr.name}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">min {gr.minSel}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">max {gr.maxSel}</span>
                    {gr.required && <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">obrigatório</span>}
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-center shrink-0">{gr.addons.length}</span>
                    <div className="w-px h-5 bg-gray-200" />
                    <button onClick={() => { setEditingGroup(isEditingGroup ? null : gr.id); setGroupEditForm({ name: gr.name, minSel: gr.minSel, maxSel: gr.maxSel, required: gr.required }); }} className={`p-1.5 rounded-md transition-colors ${isEditingGroup ? 'bg-blue-50 text-blue-500' : 'hover:bg-blue-50 text-gray-400 hover:text-blue-500'}`} title="Editar"><Pencil size={13} /></button>
                    <button onClick={() => deleteAddonGroup(gr.id)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={13} /></button>
                  </div>

                  {/* Group edit form - SEPARATE DIV below the row */}
                  {isEditingGroup && (
                    <div className="mx-3 mb-2 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 60px 60px auto' }}>
                        <input className="input text-sm" placeholder="Nome do grupo" defaultValue={gr.name} onChange={(e) => setGroupEditForm({ ...groupEditForm, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveGroupEdit(gr.id)} autoFocus />
                        <input className="input text-sm text-center" type="number" title="Mín" defaultValue={gr.minSel} onChange={(e) => setGroupEditForm({ ...groupEditForm, minSel: Number(e.target.value) })} />
                        <input className="input text-sm text-center" type="number" title="Máx" defaultValue={gr.maxSel} onChange={(e) => setGroupEditForm({ ...groupEditForm, maxSel: Number(e.target.value) })} />
                        <label className="flex items-center gap-1 text-xs text-gray-500">
                          <input type="checkbox" className="accent-amber-500 scale-90" defaultChecked={gr.required} onChange={(e) => setGroupEditForm({ ...groupEditForm, required: e.target.checked })} />
                          obrig.
                        </label>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-4 py-1.5 rounded-lg flex items-center gap-1 transition-colors" onClick={() => saveGroupEdit(gr.id)}><Check size={12} /> Salvar</button>
                        <button className="bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors" onClick={() => setEditingGroup(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {/* Addons inside group */}
                  {isGroupOpen && (
                    <div className="ml-7 mt-0 mb-1 rounded-lg border border-gray-100 bg-gray-50/50 p-2">
                      {gr.addons.map((ad: any) => {
                        const isAddonEditing = editingAddon === ad.id;
                        return (
                          <div key={ad.id}>
                            {/* Addon display row - ALWAYS shown */}
                            <div className={`flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-white`}>
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0" />
                              <span className="flex-1 text-gray-700 text-sm">{ad.name}</span>
                              <span className="text-xs font-semibold text-amber-700">{BRL(ad.price)}</span>
                              <button onClick={() => { setEditingAddon(isAddonEditing ? null : ad.id); setAddonEditForm({ name: ad.name, price: ad.price }); }} className={`p-1 rounded-md transition-colors ${isAddonEditing ? 'bg-blue-50 text-blue-500' : 'hover:bg-blue-50 text-gray-300 hover:text-blue-500'}`}><Pencil size={11} /></button>
                              <button onClick={() => deleteAddon(ad.id)} className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                            </div>

                            {/* Addon edit form - SEPARATE DIV below */}
                            {isAddonEditing && (
                              <div className="grid gap-2 py-2 px-2 ml-3 bg-blue-50 rounded-lg border border-blue-200 mb-1" style={{ gridTemplateColumns: '1fr 80px auto auto' }}>
                                <input className="input text-xs py-1" placeholder="Nome do adicional" defaultValue={ad.name} onChange={(e) => setAddonEditForm({ name: e.target.value, price: ad.price })} onKeyDown={(e) => e.key === 'Enter' && saveAddonEdit(ad.id)} autoFocus />
                                <input className="input text-xs py-1" type="number" placeholder="R$" defaultValue={ad.price} onChange={(e) => setAddonEditForm({ name: ad.name, price: Number(e.target.value) })} />
                                <button className="p-1 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors" onClick={() => saveAddonEdit(ad.id)}><Check size={12} /></button>
                                <button className="p-1 rounded-md bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors" onClick={() => setEditingAddon(null)}><X size={12} /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="grid gap-2 mt-2 pt-2 border-t border-gray-200" style={{ gridTemplateColumns: '1fr 80px auto' }}>
                        <input className="input" placeholder="Novo item" value={addonInputs[gr.id]?.name || ''} onChange={(e) => setAddonInputs((p) => ({ ...p, [gr.id]: { name: e.target.value, price: p[gr.id]?.price || '' } }))} onKeyDown={(e) => { if (e.key === 'Enter') { const nm = addonInputs[gr.id]?.name; const pr = Number(addonInputs[gr.id]?.price || 0); if (nm?.trim()) { saveAddon(gr.id, nm, pr); setAddonInputs((p) => ({ ...p, [gr.id]: { name: '', price: '' } })); } } }} />
                        <input className="input" type="number" placeholder="R$" value={addonInputs[gr.id]?.price || ''} onChange={(e) => setAddonInputs((p) => ({ ...p, [gr.id]: { name: p[gr.id]?.name || '', price: e.target.value } }))} />
                        <button className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors" onClick={() => { const nm = addonInputs[gr.id]?.name; const pr = Number(addonInputs[gr.id]?.price || 0); if (nm?.trim()) { saveAddon(gr.id, nm, pr); setAddonInputs((p) => ({ ...p, [gr.id]: { name: '', price: '' } })); } }}>+</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
