'use client';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { BRL } from '@/lib/utils';
import {
  ChevronDown, ChevronRight, Plus, Trash2, Pencil,
  Copy, Eye, EyeOff, ChevronUp, Package, Star, Flame, X, Check,
  GripVertical,
} from 'lucide-react';

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
        <div className="relative group w-10 h-10 rounded-lg overflow-hidden shrink-0 cursor-pointer" style={{ border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => ref.current?.click()}>
          <img src={value} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="text-white text-[10px] font-bold">Trocar</span></div>
          {uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white text-[10px]">...</span></div>}
        </div>
      ) : (
        <button onClick={() => ref.current?.click()} className="w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors shrink-0" style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#6b7280' }} disabled={uploading}>
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

  const [dragType, setDragType] = useState<'category' | 'product' | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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

  const swapOrders = async (aId: string, bId: string, apiType: 'categories' | 'products') => {
    const list = apiType === 'categories' ? cats : products;
    const a = list.find((x: any) => x.id === aId);
    const b = list.find((x: any) => x.id === bId);
    if (!a || !b) return;
    await fetch(`/api/${apiType === 'categories' ? 'categories' : 'products'}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, order: b.order ?? 0 }) });
    await fetch(`/api/${apiType === 'categories' ? 'categories' : 'products'}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, order: a.order ?? 0 }) });
    load();
  };

  const moveProductToCategory = async (productId: string, newCatId: string) => {
    await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: productId, categoryId: newCatId }) });
    load();
  };

  const handleDragStartCat = (e: React.DragEvent, catId: string) => {
    setDragType('category');
    setDragId(catId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStartProd = (e: React.DragEvent, prodId: string, catId: string) => {
    setDragType('product');
    setDragId(prodId);
    setDragCatId(catId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string, targetType: 'category' | 'product', targetCatId?: string) => {
    e.preventDefault();
    if (dragType !== targetType) return;
    if (targetType === 'product' && dragCatId !== targetCatId) {
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(targetId);
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(targetId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, targetType: 'category' | 'product', targetCatId?: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragId || dragType !== targetType) return;

    if (targetType === 'category' && dragId !== targetId) {
      swapOrders(dragId, targetId, 'categories');
    } else if (targetType === 'product') {
      if (dragCatId && targetCatId && dragCatId !== targetCatId) {
        moveProductToCategory(dragId, targetCatId);
      } else if (dragId !== targetId) {
        swapOrders(dragId, targetId, 'products');
      }
    }

    setDragType(null);
    setDragId(null);
    setDragCatId(null);
  };

  const handleDragEnd = () => {
    setDragType(null);
    setDragId(null);
    setDragCatId(null);
    setDropTarget(null);
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
    setEditingGroup(null); load();
  };
  const saveAddonEdit = async (addonId: string) => {
    await fetch('/api/addon-groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addonId, name: addonEditForm.name, price: addonEditForm.price }) });
    setEditingAddon(null); load();
  };
  const deleteAddonGroup = async (id: string) => { if (confirm('Excluir grupo e todos os adicionais?')) { await fetch(`/api/addon-groups?id=${id}`, { method: 'DELETE' }); load(); } };

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5 max-w-5xl" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      <div className="flex items-end justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Cardápio</h1>
            <p className="text-[10px] text-gray-500">Categorias, produtos e adicionais</p>
          </div>
        </div>
      </div>

      {/* HEADER ACTIONS */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <button onClick={() => { setShowNew(!showNew); if (!showNew && cats.length > 0 && !np.categoryId) setNp({ ...np, categoryId: cats[0].id }); }}
          className="text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 pdv-btn-hover"
          style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff', boxShadow: '0 4px 15px rgba(225,29,72,0.3)' }}>
          <Plus size={14} /> Novo Produto
        </button>
        <button onClick={() => { const allOpen = cats.every((c) => expanded[c.id]); allOpen ? collapseAll() : expandAll(); }}
          className="text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1 pdv-btn-hover"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
          {cats.every((c) => expanded[c.id]) ? <><ChevronUp size={13} /> Recolher</> : <><ChevronDown size={13} /> Abrir tudo</>}
        </button>
        <div className="flex-1" />
        <div className="flex gap-2 items-center">
          <input className="input text-xs w-48" placeholder="Nova categoria..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createCategory()} />
          <button onClick={createCategory}
            className="text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1 pdv-btn-hover"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Plus size={13} /> Categoria
          </button>
        </div>
      </div>

      {/* NEW PRODUCT FORM */}
      {showNew && (
        <div className="rounded-2xl p-4 space-y-3 mb-4" style={{ background: 'rgba(225,29,72,0.05)', border: '1px solid rgba(225,29,72,0.15)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Novo Produto</h3>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
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
              <label key={g.id} className="flex items-center gap-1 rounded-lg px-2 py-1 cursor-pointer transition-colors" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <input type="checkbox" className="accent-rose-500 scale-90" checked={np.groupIds.includes(g.id)} onChange={(e) => setNp({ ...np, groupIds: e.target.checked ? [...np.groupIds, g.id] : np.groupIds.filter((x) => x !== g.id) })} />
                <span className="text-xs text-gray-400">{g.name}</span>
              </label>
            ))}
            <div className="flex-1" />
            {['featured', 'bestSeller', 'newArrival', 'available'].map((k) => (
              <label key={k} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" className="accent-rose-500 scale-90" checked={k === 'available' ? (np.available ?? true) : !!np[k as keyof typeof np]} onChange={(e) => setNp({ ...np, [k]: e.target.checked })} />
                <span className="text-[10px] text-gray-500">{k === 'featured' ? '⭐ Destaque' : k === 'bestSeller' ? '🔥 Popular' : k === 'newArrival' ? '✨ Novidade' : '👁 Ativo'}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button className="text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 pdv-btn-hover"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }} onClick={createProduct}><Check size={14} /> Criar</button>
            <button className="text-xs font-medium px-4 py-2 rounded-xl pdv-btn-hover"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }} onClick={() => setShowNew(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* CATEGORIES + PRODUCTS */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ background: '#e11d48' }} />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Categorias & Produtos</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>{cats.length} cats · {products.length} produtos</span>
        </div>

        {cats.map((cat) => {
          const prods = productsByCat[cat.id] || [];
          const isOpen = !!expanded[cat.id];
          const isDragOverCat = dropTarget === cat.id && dragType === 'category';
          const isDraggingCat = dragId === cat.id && dragType === 'category';
          return (
            <div key={cat.id} className="mb-2"
              onDragOver={(e) => handleDragOver(e, cat.id, 'category')}
              onDrop={(e) => handleDrop(e, cat.id, 'category')}
              onDragEnd={handleDragEnd}>
              {/* CATEGORY ROW */}
              <div className="rounded-xl overflow-hidden transition-all"
                style={{
                  background: isDragOverCat ? 'rgba(225,29,72,0.08)' : 'rgba(255,255,255,0.03)',
                  border: isDragOverCat ? '1px solid rgba(225,29,72,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  opacity: isDraggingCat ? 0.5 : 1,
                }}>
                <div className="grid items-center gap-3 px-3 py-2.5" style={{ gridTemplateColumns: '24px 4px 1fr auto auto' }}>
                  <div draggable onDragStart={(e) => handleDragStartCat(e, cat.id)} className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400">
                    <GripVertical size={14} />
                  </div>
                  <div className="w-1 h-7 rounded-full shrink-0" style={{ background: '#e11d48' }} />
                  <div className="min-w-0 flex items-center gap-2">
                    <button onClick={() => toggleCat(cat.id)} className="text-gray-500 hover:text-white transition-colors shrink-0">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-white block">{cat.name}</span>
                      <span className="text-[10px] text-gray-500">{prods.length} produtos</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => renameCategory(cat.id, cat.name)} className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-blue-400" title="Renomear"><Pencil size={13} /></button>
                    <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-red-400" title="Excluir"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>

              {/* PRODUCTS INSIDE */}
              {isOpen && (
                <div className="ml-5 mt-1 mb-1 space-y-0.5 rounded-xl p-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  {prods.map((p: any) => {
                    const isDragOverProd = dropTarget === p.id && dragType === 'product';
                    const isDraggingProd = dragId === p.id && dragType === 'product';
                    return (
                      <div key={p.id}
                        onDragOver={(e) => handleDragOver(e, p.id, 'product', cat.id)}
                        onDrop={(e) => handleDrop(e, p.id, 'product', cat.id)}
                        onDragEnd={handleDragEnd}>
                        {/* Product display row */}
                        <div className="rounded-lg mb-0.5 transition-all"
                          style={{
                            background: isDragOverProd ? 'rgba(225,29,72,0.08)' : 'rgba(255,255,255,0.03)',
                            border: isDragOverProd ? '1px solid rgba(225,29,72,0.3)' : '1px solid rgba(255,255,255,0.04)',
                            opacity: isDraggingProd ? 0.4 : 1,
                          }}>
                          <div className="grid items-center gap-3 px-3 py-2" style={{ gridTemplateColumns: '24px 32px 1fr auto auto' }}>
                            <div draggable onDragStart={(e) => handleDragStartProd(e, p.id, cat.id)} className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400">
                              <GripVertical size={12} />
                            </div>
                            {p.photoUrl
                              ? <img src={p.photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                              : <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}><Package size={14} className="text-gray-600" /></div>
                            }
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="truncate text-sm text-white">{p.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {p.featured && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><Star size={7} className="inline mr-0.5" />Destaque</span>}
                                {p.bestSeller && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}><Flame size={7} className="inline mr-0.5" />Popular</span>}
                                {!p.available && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>Off</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 justify-end shrink-0">
                              {p.promoPrice && <span className="text-xs line-through" style={{ color: '#6b7280' }}>{BRL(p.price)}</span>}
                              <span className="text-sm font-bold" style={{ color: p.promoPrice ? '#22c55e' : '#d4a574' }}>{BRL(p.promoPrice ?? p.price)}</span>
                            </div>
                            <div className="flex items-center gap-0.5 justify-self-end">
                              <button onClick={() => { setEditingProduct(editingProduct === p.id ? null : p.id); setProductEditForm({ name: p.name, price: String(p.price), promoPrice: p.promoPrice ? String(p.promoPrice) : '', description: p.description || '', photoUrl: p.photoUrl || '', categoryId: p.categoryId, available: p.available, featured: p.featured, bestSeller: p.bestSeller, newArrival: p.newArrival, groupIds: p.groups?.map((g: any) => g.groupId) || [] }); }}
                                className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-blue-400" title="Editar"><Pencil size={13} /></button>
                              <button onClick={() => { fetch(`/api/products?id=${p.id}&duplicate=1`, { method: 'DELETE' }); load(); }} className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-gray-300" title="Duplicar"><Copy size={13} /></button>
                              <button onClick={() => { fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, available: !p.available }) }); load(); }}
                                className={`p-1.5 rounded-lg pdv-hover ${p.available ? 'text-amber-500' : 'text-gray-600'}`} title={p.available ? 'Desativar' : 'Ativar'}>{p.available ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                              <button onClick={() => { if (confirm('Excluir?')) { fetch(`/api/products?id=${p.id}`, { method: 'DELETE' }); load(); } }} className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-red-400" title="Excluir"><Trash2 size={13} /></button>
                            </div>
                          </div>
                        </div>

                        {/* Product edit form */}
                        {editingProduct === p.id && (
                          <div className="rounded-lg p-3 space-y-2 mb-0.5" style={{ background: 'rgba(225,29,72,0.05)', border: '1px solid rgba(225,29,72,0.15)' }}>
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
                                <label key={g.id} className="flex items-center gap-1 rounded-lg px-2 py-1 cursor-pointer transition-colors" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  <input type="checkbox" className="accent-rose-500 scale-90" checked={productEditForm.groupIds.includes(g.id)} onChange={(e) => setProductEditForm({ ...productEditForm, groupIds: e.target.checked ? [...productEditForm.groupIds, g.id] : productEditForm.groupIds.filter((x: string) => x !== g.id) })} />
                                  <span className="text-xs text-gray-400">{g.name}</span>
                                </label>
                              ))}
                            </div>
                            <div className="flex gap-2 items-center pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              {['featured', 'bestSeller', 'newArrival', 'available'].map((k) => (
                                <label key={k} className="flex items-center gap-1 cursor-pointer">
                                  <input type="checkbox" className="accent-rose-500 scale-90" checked={k === 'available' ? (productEditForm.available ?? true) : !!productEditForm[k as keyof typeof productEditForm]} onChange={(e) => setProductEditForm({ ...productEditForm, [k]: e.target.checked })} />
                                  <span className="text-[10px] text-gray-500">{k === 'featured' ? '⭐ Destaque' : k === 'bestSeller' ? '🔥 Popular' : k === 'newArrival' ? '✨ Novidade' : '👁 Ativo'}</span>
                                </label>
                              ))}
                              <div className="flex-1" />
                              <button className="text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 pdv-btn-hover"
                                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }}
                                onClick={() => { updateProduct(p.id, { ...productEditForm, price: Number(productEditForm.price), promoPrice: productEditForm.promoPrice ? Number(productEditForm.promoPrice) : null }); setEditingProduct(null); }}><Check size={13} /> Salvar</button>
                              <button className="text-xs font-medium px-3 py-2 rounded-xl pdv-btn-hover"
                                style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }} onClick={() => setEditingProduct(null)}>Cancelar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {prods.length === 0 && <p className="text-xs text-gray-600 py-3 text-center italic">Nenhum produto — arraste um produto aqui</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ADDON GROUPS */}
      <div className="mt-6">
        <button onClick={() => setShowAddons(!showAddons)} className="flex items-center gap-2 group mb-3">
          <div className="w-1 h-4 rounded-full" style={{ background: '#3b82f6' }} />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">Adicionais</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>{addonGroups.length} grupos</span>
          <span className="text-gray-500 group-hover:text-white transition-colors">{showAddons ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
        </button>

        {showAddons && (
          <div className="space-y-2">
            <div className="grid gap-2 items-center mb-3" style={{ gridTemplateColumns: '1fr 56px 56px auto' }}>
              <input className="input" placeholder="Nome do grupo (Molhos, Bebidas...)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAddonGroup()} />
              <input className="input text-center" type="number" placeholder="Mín" value={newGroupMin} onChange={(e) => setNewGroupMin(Number(e.target.value))} />
              <input className="input text-center" type="number" placeholder="Máx" value={newGroupMax} onChange={(e) => setNewGroupMax(Number(e.target.value))} />
              <button onClick={createAddonGroup}
                className="text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1 pdv-btn-hover"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>
                <Plus size={14} /> Grupo
              </button>
            </div>

            {addonGroups.map((gr) => {
              const isGroupOpen = !!expandedGroups[gr.id];
              const isEditingGroup = editingGroup === gr.id;
              return (
                <div key={gr.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="w-1 h-6 rounded-full shrink-0" style={{ background: '#3b82f6' }} />
                    <button onClick={() => setExpandedGroups((p) => ({ ...p, [gr.id]: !p[gr.id] }))} className="text-gray-500 hover:text-white transition-colors shrink-0">{isGroupOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                    <span className="text-sm font-semibold text-white truncate flex-1">{gr.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>min {gr.minSel}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>max {gr.maxSel}</span>
                    {gr.required && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>obrig.</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>{gr.addons.length}</span>
                    <button onClick={() => { setEditingGroup(isEditingGroup ? null : gr.id); setGroupEditForm({ name: gr.name, minSel: gr.minSel, maxSel: gr.maxSel, required: gr.required }); }}
                      className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-blue-400" title="Editar"><Pencil size={13} /></button>
                    <button onClick={() => deleteAddonGroup(gr.id)} className="p-1.5 rounded-lg pdv-hover text-gray-500 hover:text-red-400" title="Excluir"><Trash2 size={13} /></button>
                  </div>

                  {isEditingGroup && (
                    <div className="mx-3 mb-2 p-3 rounded-lg space-y-2" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 60px 60px auto' }}>
                        <input className="input text-sm" placeholder="Nome do grupo" defaultValue={gr.name} onChange={(e) => setGroupEditForm({ ...groupEditForm, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveGroupEdit(gr.id)} autoFocus />
                        <input className="input text-sm text-center" type="number" title="Mín" defaultValue={gr.minSel} onChange={(e) => setGroupEditForm({ ...groupEditForm, minSel: Number(e.target.value) })} />
                        <input className="input text-sm text-center" type="number" title="Máx" defaultValue={gr.maxSel} onChange={(e) => setGroupEditForm({ ...groupEditForm, maxSel: Number(e.target.value) })} />
                        <label className="flex items-center gap-1 text-xs text-gray-500">
                          <input type="checkbox" className="accent-rose-500 scale-90" defaultChecked={gr.required} onChange={(e) => setGroupEditForm({ ...groupEditForm, required: e.target.checked })} />
                          obrig.
                        </label>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button className="text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1 pdv-btn-hover"
                          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }} onClick={() => saveGroupEdit(gr.id)}><Check size={12} /> Salvar</button>
                        <button className="text-xs font-medium px-3 py-1.5 rounded-lg pdv-btn-hover"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }} onClick={() => setEditingGroup(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {isGroupOpen && (
                    <div className="ml-5 mt-0 mb-1 rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      {gr.addons.map((ad: any) => {
                        const isAddonEditing = editingAddon === ad.id;
                        return (
                          <div key={ad.id}>
                            <div className="flex items-center gap-2 py-1.5 px-1 rounded-md pdv-hover">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#3b82f6' }} />
                              <span className="flex-1 text-sm text-gray-300">{ad.name}</span>
                              <span className="text-xs font-bold" style={{ color: '#d4a574' }}>{BRL(ad.price)}</span>
                              <button onClick={() => { setEditingAddon(isAddonEditing ? null : ad.id); setAddonEditForm({ name: ad.name, price: ad.price }); }}
                                className="p-1 rounded-lg pdv-hover text-gray-600 hover:text-blue-400"><Pencil size={11} /></button>
                              <button onClick={() => deleteAddon(ad.id)} className="p-1 rounded-lg pdv-hover text-gray-600 hover:text-red-400"><Trash2 size={11} /></button>
                            </div>
                            {isAddonEditing && (
                              <div className="grid gap-2 py-2 px-2 ml-3 rounded-lg mb-1" style={{ gridTemplateColumns: '1fr 80px auto auto', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
                                <input className="input text-xs py-1" placeholder="Nome" defaultValue={ad.name} onChange={(e) => setAddonEditForm({ name: e.target.value, price: ad.price })} onKeyDown={(e) => e.key === 'Enter' && saveAddonEdit(ad.id)} autoFocus />
                                <input className="input text-xs py-1" type="number" placeholder="R$" defaultValue={ad.price} onChange={(e) => setAddonEditForm({ name: ad.name, price: Number(e.target.value) })} />
                                <button className="p-1 rounded-md" style={{ background: '#22c55e', color: '#fff' }} onClick={() => saveAddonEdit(ad.id)}><Check size={12} /></button>
                                <button className="p-1 rounded-md" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }} onClick={() => setEditingAddon(null)}><X size={12} /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="grid gap-2 mt-2 pt-2" style={{ gridTemplateColumns: '1fr 80px auto', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <input className="input" placeholder="Novo item" value={addonInputs[gr.id]?.name || ''} onChange={(e) => setAddonInputs((p) => ({ ...p, [gr.id]: { name: e.target.value, price: p[gr.id]?.price || '' } }))} onKeyDown={(e) => { if (e.key === 'Enter') { const nm = addonInputs[gr.id]?.name; const pr = Number(addonInputs[gr.id]?.price || 0); if (nm?.trim()) { saveAddon(gr.id, nm, pr); setAddonInputs((p) => ({ ...p, [gr.id]: { name: '', price: '' } })); } } }} />
                        <input className="input" type="number" placeholder="R$" value={addonInputs[gr.id]?.price || ''} onChange={(e) => setAddonInputs((p) => ({ ...p, [gr.id]: { name: p[gr.id]?.name || '', price: e.target.value } }))} />
                        <button className="text-xs font-bold px-3 py-2 rounded-lg pdv-btn-hover"
                          style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' }}
                          onClick={() => { const nm = addonInputs[gr.id]?.name; const pr = Number(addonInputs[gr.id]?.price || 0); if (nm?.trim()) { saveAddon(gr.id, nm, pr); setAddonInputs((p) => ({ ...p, [gr.id]: { name: '', price: '' } })); } }}>+</button>
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
