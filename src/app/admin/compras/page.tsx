'use client';
import { useEffect, useMemo, useState } from 'react';
import { ShoppingBasket, Plus, Printer, Trash2, Pencil, Check, X, Eraser } from 'lucide-react';
import { printReceiptText, showToast } from '@/lib/utils';

type Item = { id: string; categoryId: string; name: string; qty: string; done: boolean; createdAt: number };
type Categoria = { id: string; name: string };
type Lista = { categories: Categoria[]; items: Item[] };

const CORES = ['#e11d48', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#06b6d4', '#f97316', '#14b8a6'];
const LARGURA = 24; // colunas do cupom (fonte 2x1 na térmica de 80mm)

export default function Compras() {
  const [lista, setLista] = useState<Lista | null>(null);
  const [adds, setAdds] = useState<Record<string, { name: string; qty: string }>>({});
  const [editCat, setEditCat] = useState<{ id: string; name: string } | null>(null);
  const [delCat, setDelCat] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<{ id: string; name: string; qty: string } | null>(null);
  const [delItem, setDelItem] = useState<string | null>(null);
  const [novaCat, setNovaCat] = useState('');
  const [showNovaCat, setShowNovaCat] = useState(false);
  const [limpar, setLimpar] = useState(false);

  const carregar = () =>
    fetch('/api/shopping', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setLista)
      .catch(() => showToast('Não foi possível carregar a lista', 'error'));

  useEffect(() => { carregar(); }, []);

  const post = async (body: any) => {
    try {
      const r = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || 'Erro ao salvar', 'error'); return false; }
      setLista(d);
      return true;
    } catch {
      showToast('Sem conexão com o servidor', 'error');
      return false;
    }
  };

  const porCategoria = useMemo(() => {
    const mapa: Record<string, Item[]> = {};
    for (const it of lista?.items || []) {
      if (!mapa[it.categoryId]) mapa[it.categoryId] = [];
      mapa[it.categoryId].push(it);
    }
    for (const id of Object.keys(mapa)) {
      mapa[id].sort((a, b) => Number(a.done) - Number(b.done) || a.name.localeCompare(b.name, 'pt-BR'));
    }
    return mapa;
  }, [lista]);

  const totalItens = lista?.items.length || 0;
  const comprados = (lista?.items || []).filter((i) => i.done).length;
  const pendentes = totalItens - comprados;
  const pct = totalItens ? Math.round((comprados / totalItens) * 100) : 0;

  const adicionar = async (catId: string) => {
    const a = adds[catId];
    const name = (a?.name || '').trim();
    if (!name) return;
    const ok = await post({ action: 'addItem', categoryId: catId, name, qty: a?.qty || '' });
    if (ok) setAdds((prev) => ({ ...prev, [catId]: { name: '', qty: prev[catId]?.qty || '' } }));
  };

  const salvarItem = async () => {
    if (!editItem) return;
    const name = editItem.name.trim();
    if (!name) return;
    const ok = await post({ action: 'updateItem', id: editItem.id, name, qty: editItem.qty });
    if (ok) setEditItem(null);
  };

  const criarCategoria = async () => {
    const name = novaCat.trim();
    if (!name) return;
    const ok = await post({ action: 'addCategory', name });
    if (ok) { setNovaCat(''); setShowNovaCat(false); }
  };

  const imprimir = async () => {
    if (!lista) return;
    const itens = lista.items.filter((i) => i.name);
    if (itens.length === 0) { showToast('Adicione itens antes de imprimir', 'warning'); return; }

    const wrap = (texto: string, prefixo: string, continua: string) => {
      const linhas: string[] = [];
      let t = texto.trim();
      let pre = prefixo;
      while (t.length > 0) {
        const limite = Math.max(4, LARGURA - pre.length);
        if (t.length <= limite) { linhas.push((pre + t).slice(0, LARGURA)); break; }
        let corte = t.lastIndexOf(' ', limite);
        if (corte <= 0) corte = limite;
        linhas.push((pre + t.slice(0, corte)).slice(0, LARGURA));
        t = t.slice(corte).trim();
        pre = continua;
      }
      return linhas;
    };

    const partes: string[] = [];
    partes.push('LISTA DE COMPRAS');
    partes.push(new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }));
    partes.push('='.repeat(LARGURA));
    let total = 0;
    let feitos = 0;
    for (const cat of lista.categories) {
      const doCat = itens.filter((i) => i.categoryId === cat.id)
        .sort((a, b) => Number(a.done) - Number(b.done) || a.name.localeCompare(b.name, 'pt-BR'));
      if (doCat.length === 0) continue;
      partes.push(cat.name.toUpperCase().slice(0, LARGURA));
      partes.push('-'.repeat(LARGURA));
      for (const it of doCat) {
        total++;
        if (it.done) feitos++;
        const marca = it.done ? '[x]' : '[ ]';
        partes.push(...wrap(it.name, `${marca} ${it.qty ? it.qty + ' ' : ''}`, '    '));
      }
    }
    partes.push('='.repeat(LARGURA));
    partes.push(`${total} item(ns) - ${feitos} comprado(s)`);
    const texto = partes.join('\n');

    await fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: texto, printer: 'Padrao' }) }).catch(() => {});
    printReceiptText(texto);
  };

  if (!lista) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center" style={{ color: '#6b7280' }}>
        <p className="text-xs font-bold animate-pulse">Carregando lista…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-48px)] rounded-2xl p-4 md:p-5" style={{ background: '#1a1520', color: '#f0e8e0' }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 4px 16px rgba(225,29,72,0.25)' }}>
            <ShoppingBasket size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-tight">Lista de Compras</h1>
            <p className="text-[10px] text-gray-500">{totalItens} item(ns) · {pendentes} a comprar · {comprados} comprado(s)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowNovaCat((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#c0b8c8', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Plus size={13} /> Categoria
          </button>
          {limpar ? (
            <span className="flex items-center gap-1 rounded-xl px-2 py-1.5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <span className="text-[10px] font-bold px-1" style={{ color: '#f87171' }}>Limpar comprados?</span>
              <button onClick={async () => { setLimpar(false); await post({ action: 'clearDone' }); }}
                className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}><Check size={12} /></button>
              <button onClick={() => setLimpar(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}><X size={12} /></button>
            </span>
          ) : (
            <button onClick={() => setLimpar(true)} disabled={comprados === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#c0b8c8', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Eraser size={13} /> Limpar comprados
            </button>
          )}
          <button onClick={imprimir}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-white transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}>
            <Printer size={13} /> Imprimir
          </button>
        </div>
      </div>

      {/* Progresso */}
      <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #e11d48, #f59e0b)', boxShadow: '0 0 10px rgba(225,29,72,0.5)' }} />
      </div>

      {/* Nova categoria */}
      {showNovaCat && (
        <div className="flex flex-wrap items-center gap-2 mb-4 rounded-xl p-3" style={{ background: 'rgba(225,29,72,0.04)', border: '1px solid rgba(225,29,72,0.15)' }}>
          <input autoFocus value={novaCat} onChange={(e) => setNovaCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') criarCategoria(); if (e.key === 'Escape') { setShowNovaCat(false); setNovaCat(''); } }}
            placeholder="Nome da categoria (ex: Frios, Hortifruti, Bebidas...)" className="input flex-1 min-w-[180px]" />
          <button onClick={criarCategoria} className="btn-primary text-[11px] px-3 py-2">Adicionar</button>
          <button onClick={() => { setShowNovaCat(false); setNovaCat(''); }} className="btn-ghost text-[11px] px-3 py-2">Cancelar</button>
        </div>
      )}

      {/* Categorias */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {lista.categories.map((cat, idx) => {
          const cor = CORES[idx % CORES.length];
          const doCat = porCategoria[cat.id] || [];
          const feitosCat = doCat.filter((i) => i.done).length;
          const restantes = doCat.length - feitosCat;
          return (
            <div key={cat.id} className="rounded-xl flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* cabeçalho da categoria */}
              <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor, boxShadow: `0 0 8px ${cor}80` }} />
                {editCat && editCat.id === cat.id ? (
                  <input autoFocus value={editCat.name}
                    onChange={(e) => setEditCat({ id: cat.id, name: e.target.value })}
                    onBlur={() => { if (editCat.name.trim()) post({ action: 'renameCategory', id: cat.id, name: editCat.name }); setEditCat(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { if (editCat.name.trim()) post({ action: 'renameCategory', id: cat.id, name: editCat.name }); setEditCat(null); }
                      if (e.key === 'Escape') setEditCat(null);
                    }}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[12px] font-bold border-b"
                    style={{ color: '#f0e8e0', borderColor: 'rgba(225,29,72,0.5)' }} />
                ) : (
                  <button onClick={() => setEditCat({ id: cat.id, name: cat.name })} title="Clique para renomear"
                    className="flex-1 min-w-0 text-left text-[12px] font-black uppercase tracking-wide truncate transition-opacity hover:opacity-70">
                    {cat.name}
                  </button>
                )}
                <span className="text-[9px] font-bold shrink-0" style={{ color: restantes > 0 ? cor : '#4b5563' }}>
                  {doCat.length === 0 ? 'vazia' : `${restantes} de ${doCat.length}`}
                </span>
                {delCat === cat.id ? (
                  <span className="flex items-center gap-1 shrink-0">
                    <button onClick={async () => { setDelCat(null); await post({ action: 'deleteCategory', id: cat.id }); }} title="Confirmar exclusão"
                      className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}><Check size={10} /></button>
                    <button onClick={() => setDelCat(null)} title="Cancelar"
                      className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}><X size={10} /></button>
                  </span>
                ) : (
                  <button onClick={() => setDelCat(cat.id)} title="Excluir categoria"
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors" style={{ color: '#4b5563' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#f87171'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4b5563'; }}>
                    <Trash2 size={11} />
                  </button>
                )}
              </div>

              {/* adicionar item */}
              <div className="flex items-center gap-1.5 px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.14)' }}>
                <input value={adds[cat.id]?.qty || ''} onChange={(e) => setAdds((p) => ({ ...p, [cat.id]: { name: p[cat.id]?.name || '', qty: e.target.value } }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') adicionar(cat.id); }}
                  placeholder="Qtd" className="w-14 shrink-0 rounded-lg px-2 py-1.5 text-[11px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#f0e8e0' }} />
                <input value={adds[cat.id]?.name || ''} onChange={(e) => setAdds((p) => ({ ...p, [cat.id]: { name: e.target.value, qty: p[cat.id]?.qty || '' } }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') adicionar(cat.id); }}
                  placeholder="Adicionar item…" className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-[11px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#f0e8e0' }} />
                <button onClick={() => adicionar(cat.id)} title="Adicionar"
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-95"
                  style={{ background: `${cor}22`, color: cor, border: `1px solid ${cor}35` }}>
                  <Plus size={14} />
                </button>
              </div>

              {/* itens */}
              <div className="flex-1">
                {doCat.length === 0 ? (
                  <p className="px-3.5 py-3 text-[10px]" style={{ color: '#4b5563' }}>Nenhum item ainda</p>
                ) : doCat.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 px-3 py-2 group" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <button onClick={() => post({ action: 'toggleItem', id: it.id })} title={it.done ? 'Desmarcar' : 'Marcar como comprado'}
                      className="w-4 h-4 rounded-[5px] flex items-center justify-center shrink-0 transition-all duration-150"
                      style={{ background: it.done ? cor : 'transparent', border: `1.5px solid ${it.done ? cor : 'rgba(255,255,255,0.18)'}` }}>
                      {it.done && <Check size={10} className="text-white" />}
                    </button>
                    {editItem && editItem.id === it.id ? (
                      <>
                        <input autoFocus value={editItem.qty} onChange={(e) => setEditItem({ ...editItem, qty: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') salvarItem(); if (e.key === 'Escape') setEditItem(null); }}
                          placeholder="Qtd" className="w-12 shrink-0 rounded px-1.5 py-1 text-[11px] outline-none"
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(225,29,72,0.4)', color: '#f0e8e0' }} />
                        <input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') salvarItem(); if (e.key === 'Escape') setEditItem(null); }}
                          className="flex-1 min-w-0 rounded px-1.5 py-1 text-[11px] outline-none"
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(225,29,72,0.4)', color: '#f0e8e0' }} />
                        <button onClick={salvarItem} className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}><Check size={11} /></button>
                        <button onClick={() => setEditItem(null)} className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}><X size={11} /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 min-w-0 text-[11.5px] truncate" style={{ color: it.done ? '#4b5563' : '#e6ddd4', textDecoration: it.done ? 'line-through' : 'none' }}>
                          {it.qty && <span className="font-black mr-1.5" style={{ color: it.done ? '#4b5563' : cor }}>{it.qty}</span>}
                          {it.name}
                        </span>
                        <button onClick={() => { setDelItem(null); setEditItem({ id: it.id, name: it.name, qty: it.qty }); }} title="Editar"
                          className="w-6 h-6 rounded flex items-center justify-center shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: '#6b7280' }}><Pencil size={11} /></button>
                        {delItem === it.id ? (
                          <span className="flex items-center gap-1 shrink-0">
                            <button onClick={async () => { setDelItem(null); await post({ action: 'deleteItem', id: it.id }); }} title="Confirmar"
                              className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}><Check size={10} /></button>
                            <button onClick={() => setDelItem(null)} title="Cancelar"
                              className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}><X size={10} /></button>
                          </span>
                        ) : (
                          <button onClick={() => setDelItem(it.id)} title="Excluir"
                            className="w-6 h-6 rounded flex items-center justify-center shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: '#6b7280' }}><Trash2 size={11} /></button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {lista.categories.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <ShoppingBasket size={26} className="mx-auto mb-2" style={{ color: '#4b5563' }} />
          <p className="text-xs font-bold" style={{ color: '#6b7280' }}>Nenhuma categoria — crie a primeira em “+ Categoria”.</p>
        </div>
      )}

      <p className="text-[9px] mt-4 text-center" style={{ color: '#3f3a45' }}>
        A lista é compartilhada entre o painel e o aplicativo · clique no nome da categoria para renomear
      </p>
    </div>
  );
}
