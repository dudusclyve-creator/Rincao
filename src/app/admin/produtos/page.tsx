'use client';
import { useEffect, useState, useMemo } from 'react';
import { BRL } from '@/lib/utils';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, ChevronDown, ChevronRight, Plus, Trash2, Pencil,
  Copy, Eye, EyeOff, ChevronUp, Package, Star, Flame, X, Check,
} from 'lucide-react';

const GRID = '14px 32px 1fr 90px auto auto';

/* ══════════ SORTABLE WRAPPER (no built-in grip) ══════════ */
function SortRow({ id, children, className = '' }: { id: string; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const s: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1, zIndex: isDragging ? 999 : undefined };
  return (
    <div ref={setNodeRef} style={s} className={className}>
      <div className="grid items-center gap-3 px-3 py-2" style={{ gridTemplateColumns: GRID }}>
        {/* Grip handle — first column */}
        <button className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none flex items-center justify-center" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </button>
        {/* Rest of columns passed as children */}
        {children}
      </div>
    </div>
  );
}

/* ══════════ PRODUCT ROW ══════════ */
function ProductRow({ p, cats, groupsList, onSave, onDuplicate, onToggle, onDelete }: {
  p: any; cats: any[]; groupsList: any[];
  onSave: (id: string, data: any) => void; onDuplicate: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    name: p.name, price: p.price, promoPrice: p.promoPrice || '',
    description: p.description, photoUrl: p.photoUrl, categoryId: p.categoryId,
    available: p.available, featured: p.featured, bestSeller: p.bestSeller,
    groupIds: p.groups?.map((g: any) => g.groupId) || [],
  });
  const save = () => { onSave(p.id, { ...f, price: Number(f.price), promoPrice: f.promoPrice ? Number(f.promoPrice) : null }); setEditing(false); };

  if (!editing) {
    return (
      <>
        {/* Col 2: Photo */}
        {p.photoUrl
          ? <img src={p.photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          : <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center"><Package size={14} className="text-gray-400" /></div>
        }
        {/* Col 3: Name + tags */}
        <div className="min-w-0 flex items-center gap-2">
          <span className="truncate text-sm text-gray-700">{p.name}</span>
          <div className="flex items-center gap-1 shrink-0">
            {p.featured && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium border border-amber-100"><Star size={8} className="inline mr-0.5" />Destaque</span>}
            {p.bestSeller && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-medium border border-red-100"><Flame size={8} className="inline mr-0.5" />Popular</span>}
            {!p.available && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full border border-gray-200">Off</span>}
          </div>
        </div>
        {/* Col 4: Price */}
        <div className="flex items-center gap-1.5 justify-end shrink-0">
          {p.promoPrice && <span className="text-xs text-gray-400 line-through">{BRL(p.price)}</span>}
          <span className={`text-sm font-semibold ${p.promoPrice ? 'text-emerald-600' : 'text-amber-700'}`}>{BRL(p.promoPrice ?? p.price)}</span>
        </div>
        {/* Col 5: separator */}
        <div className="w-px h-5 bg-gray-200 justify-self-center" />
        {/* Col 6: Actions */}
        <div className="flex items-center gap-0.5 justify-self-end">
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-500 transition-colors" title="Editar"><Pencil size={13} /></button>
          <button onClick={onDuplicate} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Duplicar"><Copy size={13} /></button>
          <button onClick={onToggle} className={`p-1.5 rounded-md transition-colors ${p.available ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-gray-100 text-gray-300'}`} title={p.available ? 'Desativar' : 'Ativar'}>{p.available ? <Eye size={13} /> : <EyeOff size={13} />}</button>
          <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 text-red-400 transition-colors" title="Excluir"><Trash2 size={13} /></button>
        </div>
      </>
    );
  }

  return (
    <div className="col-span-6 p-3 rounded-xl bg-white border border-amber-200 shadow-sm space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <input className="input" placeholder="Nome *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="Preço *" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <input className="input" placeholder="Preço promo" type="number" value={f.promoPrice || ''} onChange={(e) => setF({ ...f, promoPrice: e.target.value })} />
      </div>
      <input className="input w-full" placeholder="Descrição" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Foto URL" value={f.photoUrl || ''} onChange={(e) => setF({ ...f, photoUrl: e.target.value })} />
        <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {groupsList.map((g) => (
          <label key={g.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 cursor-pointer hover:border-amber-300 transition-colors">
            <input type="checkbox" className="accent-amber-500 scale-90" checked={f.groupIds.includes(g.id)} onChange={(e) => setF({ ...f, groupIds: e.target.checked ? [...f.groupIds, g.id] : f.groupIds.filter((x: string) => x !== g.id) })} />
            <span className="text-xs text-gray-600">{g.name}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 items-center pt-2 border-t border-gray-100">
        {['featured', 'bestSeller', 'available'].map((k) => (
          <label key={k} className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" className="accent-amber-500 scale-90" checked={k === 'available' ? (f.available ?? true) : !!f[k as keyof typeof f]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />
            <span className="text-xs text-gray-500">{k === 'featured' ? '⭐ Destaque' : k === 'bestSeller' ? '🔥 Popular' : '👁 Ativo'}</span>
          </label>
        ))}
        <div className="flex-1" />
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center gap-1 transition-colors" onClick={save}><Check size={13} /> Salvar</button>
        <button className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg transition-colors" onClick={() => setEditing(false)}>Cancelar</button>
      </div>
    </div>
  );
}

/* ══════════ ADDON GROUP ══════════ */
function AddonGroupRow({ gr, onSaveAddon, onDeleteAddon, onDeleteGroup }: {
  gr: any; onSaveAddon: (g: string, n: string, p: number) => void; onDeleteAddon: (id: string) => void; onDeleteGroup: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [aName, setAName] = useState('');
  const [aPrice, setAPrice] = useState(0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setOpen(!open)}>
        <button className="text-gray-400 hover:text-gray-600 transition-colors">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
        <div className="w-1 h-6 bg-blue-400 rounded-full shrink-0" />
        <span className="text-sm font-semibold text-gray-800 flex-1">{gr.name}</span>
        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">min {gr.minSel}</span>
        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">max {gr.maxSel}</span>
        {gr.required && <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">obrigatório</span>}
        <span className="text-xs text-gray-400">{gr.addons.length} itens</span>
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <button onClick={(e) => { e.stopPropagation(); onDeleteGroup(); }} className="p-1.5 rounded-md hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={13} /></button>
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-1 border-t border-gray-100">
          {gr.addons.map((ad: any) => (
            <div key={ad.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0" />
              <span className="flex-1 text-gray-700">{ad.name}</span>
              <span className="text-xs font-semibold text-amber-700">{BRL(ad.price)}</span>
              <button onClick={() => onDeleteAddon(ad.id)} className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
            </div>
          ))}
          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
            <input className="input flex-1" placeholder="Novo item" value={aName} onChange={(e) => setAName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && aName.trim()) { onSaveAddon(gr.id, aName, aPrice); setAName(''); setAPrice(0); } }} />
            <input className="input w-24" type="number" placeholder="R$" value={aPrice || ''} onChange={(e) => setAPrice(Number(e.target.value))} />
            <button className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors" onClick={() => { if (aName.trim()) { onSaveAddon(gr.id, aName, aPrice); setAName(''); setAPrice(0); } }}>+</button>
          </div>
        </div>
      )}
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
  const [np, setNp] = useState({ name: '', price: '', promoPrice: '', description: '', photoUrl: '', categoryId: '', groupIds: [] as string[], available: true, featured: false, bestSeller: false });
  const [showAddons, setShowAddons] = useState(false);
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const productsByCat = useMemo(() => {
    const m: Record<string, any[]> = {};
    cats.forEach((c) => { m[c.id] = products.filter((p) => p.categoryId === c.id).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)); });
    return m;
  }, [cats, products]);

  const expandAll = () => { const m: Record<string, boolean> = {}; cats.forEach((c) => { m[c.id] = true; }); setExpanded(m); };
  const collapseAll = () => setExpanded({});
  const toggleCat = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const handleCatDrag = async (e: DragEndEvent) => {
    const old = cats.findIndex((c) => c.id === e.active.id);
    const nw = cats.findIndex((c) => c.id === e.over!.id);
    if (old === -1 || nw === -1 || old === nw) return;
    const r = arrayMove(cats, old, nw);
    setCats(r);
    for (let i = 0; i < r.length; i++) await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r[i].id, order: i }) });
  };

  const handleProdDrag = async (e: DragEndEvent, catId: string) => {
    const cp = productsByCat[catId] || [];
    const old = cp.findIndex((p: any) => p.id === e.active.id);
    const nw = cp.findIndex((p: any) => p.id === e.over!.id);
    if (old === -1 || nw === -1 || old === nw) return;
    const r = arrayMove(cp, old, nw);
    setProducts([...products.filter((p) => p.categoryId !== catId), ...r]);
    for (let i = 0; i < r.length; i++) await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r[i].id, order: i }) });
  };

  const createProduct = async () => {
    if (!np.name || !np.price || !np.categoryId) return;
    await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...np, price: Number(np.price), promoPrice: np.promoPrice ? Number(np.promoPrice) : null, description: np.description || '', order: productsByCat[np.categoryId]?.length || 0 }) });
    setNp({ name: '', price: '', promoPrice: '', description: '', photoUrl: '', categoryId: '', groupIds: [], available: true, featured: false, bestSeller: false });
    setShowNew(false); load();
  };

  const updateProduct = async (id: string, data: any) => {
    await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...data }) });
    load();
  };

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCatName, order: cats.length }) });
    setNewCatName(''); load();
  };

  const renameCategory = async (id: string, name: string) => {
    const n = prompt('Renomear categoria', name);
    if (n) { await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: n }) }); load(); }
  };

  const deleteCategory = async (id: string) => {
    if (confirm('Excluir categoria e todos os produtos?')) { await fetch(`/api/categories?id=${id}`, { method: 'DELETE' }); load(); }
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
  const deleteAddonGroup = async (id: string) => { if (confirm('Excluir grupo?')) { await fetch(`/api/addon-groups?id=${id}`, { method: 'DELETE' }); load(); } };

  const handleGroupDrag = async (e: DragEndEvent) => {
    const old = addonGroups.findIndex((g) => g.id === e.active.id);
    const nw = addonGroups.findIndex((g) => g.id === e.over!.id);
    if (old === -1 || nw === -1 || old === nw) return;
    const r = arrayMove(addonGroups, old, nw);
    setAddonGroups(r);
    for (let i = 0; i < r.length; i++) await fetch('/api/addon-groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r[i].id, order: i }) });
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Cardápio</h1>
          <p className="text-sm text-gray-400 mt-0.5">Categorias, produtos e adicionais do seu cardápio.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => { setShowNew(!showNew); if (!showNew && cats.length > 0 && !np.categoryId) setNp({ ...np, categoryId: cats[0].id }); }} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors">
          <Plus size={15} /> Novo Produto
        </button>
        <button onClick={expandAll} className="bg-white border border-gray-200 hover:border-gray-300 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"><ChevronDown size={13} /> Abrir tudo</button>
        <button onClick={collapseAll} className="bg-white border border-gray-200 hover:border-gray-300 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"><ChevronUp size={13} /> Recolher tudo</button>
        <div className="flex-1" />
        <div className="flex gap-2 items-center">
          <input className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-100 outline-none w-48 transition-all" placeholder="Nova categoria..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createCategory()} />
          <button onClick={createCategory} className="bg-white border border-gray-200 hover:border-amber-300 text-gray-600 hover:text-amber-600 text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"><Plus size={14} /> Categoria</button>
        </div>
      </div>

      {showNew && (
        <div className="rounded-xl border border-amber-200 bg-white p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Novo Produto</h3>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder="Nome *" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
            <input className="input" placeholder="Preço *" type="number" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} />
            <input className="input" placeholder="Preço promo" type="number" value={np.promoPrice || ''} onChange={(e) => setNp({ ...np, promoPrice: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select className="input" value={np.categoryId} onChange={(e) => setNp({ ...np, categoryId: e.target.value })}><option value="">Categoria *</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input className="input" placeholder="Descrição" value={np.description || ''} onChange={(e) => setNp({ ...np, description: e.target.value })} />
            <input className="input" placeholder="Foto URL" value={np.photoUrl || ''} onChange={(e) => setNp({ ...np, photoUrl: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {groupsList.map((g) => (
              <label key={g.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 cursor-pointer hover:border-amber-300 transition-colors">
                <input type="checkbox" className="accent-amber-500 scale-90" checked={np.groupIds.includes(g.id)} onChange={(e) => setNp({ ...np, groupIds: e.target.checked ? [...np.groupIds, g.id] : np.groupIds.filter((x) => x !== g.id) })} />
                <span className="text-xs text-gray-600">{g.name}</span>
              </label>
            ))}
            <div className="flex-1" />
            {['featured', 'bestSeller', 'available'].map((k) => (
              <label key={k} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" className="accent-amber-500 scale-90" checked={k === 'available' ? (np.available ?? true) : !!np[k as keyof typeof np]} onChange={(e) => setNp({ ...np, [k]: e.target.checked })} />
                <span className="text-xs text-gray-500">{k === 'featured' ? '⭐ Destaque' : k === 'bestSeller' ? '🔥 Popular' : '👁 Ativo'}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors" onClick={createProduct}><Check size={14} /> Criar Produto</button>
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => setShowNew(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ═══════ CATEGORIES + PRODUCTS ═══════ */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-amber-500 rounded-full" />
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categorias & Produtos</h2>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{cats.length} categorias · {products.length} produtos</span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCatDrag}>
          <SortableContext items={cats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cats.map((cat) => {
              const prods = productsByCat[cat.id] || [];
              const isOpen = !!expanded[cat.id];
              return (
                <div key={cat.id} className="mb-2">
                  {/* ═══ CATEGORY ROW ═══ */}
                  <SortRow id={cat.id} className="rounded-xl border border-gray-200 bg-white hover:shadow-sm transition-all overflow-hidden">
                    {/* Col 2: Bar */}
                    <div className="w-1 h-7 bg-amber-400 rounded-full shrink-0" />
                    {/* Col 3: Name + count */}
                    <div className="min-w-0 flex items-center gap-2">
                      <button onClick={() => toggleCat(cat.id)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-gray-800 block">{cat.name}</span>
                        <span className="text-[10px] text-gray-400">{prods.length} produtos</span>
                      </div>
                    </div>
                    {/* Col 4: Badge */}
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-center shrink-0">{prods.length}</span>
                    {/* Col 5: separator */}
                    <div className="w-px h-5 bg-gray-200 justify-self-center" />
                    {/* Col 6: Actions */}
                    <div className="flex items-center gap-0.5 justify-self-end">
                      <button onClick={() => renameCategory(cat.id, cat.name)} className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors" title="Renomear"><Pencil size={13} /></button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={13} /></button>
                    </div>
                  </SortRow>

                  {/* ═══ PRODUCTS INSIDE ═══ */}
                  {isOpen && (
                    <div className="ml-7 mt-1 mb-1 space-y-0.5 rounded-xl border border-gray-100 bg-gray-50/50 p-1.5">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleProdDrag(e, cat.id)}>
                        <SortableContext items={prods.map((p: any) => p.id)} strategy={verticalListSortingStrategy}>
                          {prods.map((p: any) => (
                            <SortRow key={p.id} id={p.id} className="bg-white rounded-lg border border-gray-100 mb-0.5 last:mb-0">
                              <ProductRow p={p} cats={cats} groupsList={groupsList} onSave={updateProduct} onDuplicate={() => { fetch(`/api/products?id=${p.id}&duplicate=1`, { method: 'DELETE' }); load(); }} onToggle={() => { fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, available: !p.available }) }); load(); }} onDelete={() => { if (confirm('Excluir?')) { fetch(`/api/products?id=${p.id}`, { method: 'DELETE' }); load(); } }} />
                            </SortRow>
                          ))}
                        </SortableContext>
                      </DndContext>
                      {prods.length === 0 && <p className="text-xs text-gray-400 py-3 text-center italic">Nenhum produto nesta categoria</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>
      </div>

      {/* ═══════ ADDON GROUPS ═══════ */}
      <div>
        <button onClick={() => setShowAddons(!showAddons)} className="flex items-center gap-2 group mb-2">
          <div className="w-1 h-4 bg-blue-400 rounded-full" />
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors">Adicionais</h2>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{addonGroups.length} grupos</span>
          <span className="text-gray-400 group-hover:text-gray-600 transition-colors">{showAddons ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
        </button>

        {showAddons && (
          <div className="space-y-2">
            <div className="flex gap-2 items-center mb-3">
              <input className="input flex-1" placeholder="Nome do grupo (ex: Molhos, Bebidas...)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAddonGroup()} />
              <input className="input w-20" type="number" placeholder="Mín" value={newGroupMin} onChange={(e) => setNewGroupMin(Number(e.target.value))} />
              <input className="input w-20" type="number" placeholder="Máx" value={newGroupMax} onChange={(e) => setNewGroupMax(Number(e.target.value))} />
              <button className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"><Plus size={14} /> Grupo</button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDrag}>
              <SortableContext items={addonGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                {addonGroups.map((gr) => (
                  <SortRow key={gr.id} id={gr.id} className="">
                    {/* Col 2: Bar */}
                    <div className="w-1 h-6 bg-blue-400 rounded-full shrink-0" />
                    {/* Col 3: Name + info */}
                    <div className="min-w-0 flex items-center gap-2">
                      <button onClick={() => {}} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"><ChevronRight size={14} /></button>
                      <span className="text-sm font-semibold text-gray-800 truncate">{gr.name}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">min {gr.minSel}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">max {gr.maxSel}</span>
                      {gr.required && <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">obrigatório</span>}
                    </div>
                    {/* Col 4: Count */}
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-center shrink-0">{gr.addons.length}</span>
                    {/* Col 5: separator */}
                    <div className="w-px h-5 bg-gray-200 justify-self-center" />
                    {/* Col 6: Actions */}
                    <div className="flex items-center gap-0.5 justify-self-end">
                      <button onClick={() => {}} className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors" title="Renomear"><Pencil size={13} /></button>
                      <button onClick={() => deleteAddonGroup(gr.id)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={13} /></button>
                    </div>
                  </SortRow>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}
