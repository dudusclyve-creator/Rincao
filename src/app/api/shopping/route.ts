import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';

// Lista de compras do restaurante (embalagens, mercado, carnes...).
// Fica no Setting "shoppingList" para o app e o site usarem a mesma lista.
const KEY = 'shoppingList';

const CATEGORIAS_PADRAO = ['Embalagens', 'Mercado', 'Carnes', 'Padaria', 'Limpeza'];

type Item = { id: string; categoryId: string; name: string; qty: string; done: boolean; createdAt: number };
type Categoria = { id: string; name: string };
type Lista = { categories: Categoria[]; items: Item[] };

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function padrao(): Lista {
  return { categories: CATEGORIAS_PADRAO.map((name, i) => ({ id: `cat-${i + 1}`, name })), items: [] };
}

async function ler(): Promise<Lista> {
  const s = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!s) return padrao();
  try {
    const d = JSON.parse(s.value);
    return {
      categories: Array.isArray(d.categories) && d.categories.length > 0
        ? d.categories.filter((c: any) => c && c.id && c.name).map((c: any) => ({ id: String(c.id), name: String(c.name) }))
        : padrao().categories,
      items: Array.isArray(d.items)
        ? d.items.filter((i: any) => i && i.id).map((i: any) => ({
            id: String(i.id), categoryId: String(i.categoryId || ''), name: String(i.name || ''),
            qty: String(i.qty || ''), done: !!i.done, createdAt: Number(i.createdAt) || 0,
          }))
        : [],
    };
  } catch {
    return padrao();
  }
}

async function gravar(d: Lista) {
  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(d) },
    create: { key: KEY, value: JSON.stringify(d) },
  });
}

export async function GET() {
  return NextResponse.json(await ler(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const b = await req.json();
  const d = await ler();
  const texto = (v: any) => String(v || '').replace(/\s+/g, ' ').trim();

  switch (b.action) {
    case 'addCategory': {
      const name = texto(b.name);
      if (!name) return NextResponse.json({ error: 'Informe o nome da categoria' }, { status: 400 });
      if (!d.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        d.categories.push({ id: novoId(), name });
      }
      break;
    }
    case 'renameCategory': {
      const name = texto(b.name);
      const cat = d.categories.find((c) => c.id === b.id);
      if (cat && name) cat.name = name;
      break;
    }
    case 'deleteCategory': {
      d.categories = d.categories.filter((c) => c.id !== b.id);
      d.items = d.items.filter((i) => i.categoryId !== b.id);
      break;
    }
    case 'addItem': {
      const name = texto(b.name);
      if (!name) return NextResponse.json({ error: 'Informe o item' }, { status: 400 });
      if (!d.categories.some((c) => c.id === b.categoryId)) return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 });
      d.items.push({
        id: novoId(), categoryId: String(b.categoryId), name,
        qty: texto(b.qty), done: false, createdAt: Date.now(),
      });
      break;
    }
    case 'updateItem': {
      const it = d.items.find((i) => i.id === b.id);
      if (it) {
        if (b.name !== undefined) it.name = texto(b.name) || it.name;
        if (b.qty !== undefined) it.qty = texto(b.qty);
        if (b.categoryId !== undefined && d.categories.some((c) => c.id === b.categoryId)) it.categoryId = String(b.categoryId);
      }
      break;
    }
    case 'toggleItem': {
      const it = d.items.find((i) => i.id === b.id);
      if (it) it.done = !it.done;
      break;
    }
    case 'deleteItem':
      d.items = d.items.filter((i) => i.id !== b.id);
      break;
    case 'clearDone':
      d.items = d.items.filter((i) => !i.done);
      break;
    case 'clearAll':
      d.items = [];
      break;
    default:
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  }

  await gravar(d);
  return NextResponse.json(d);
}
