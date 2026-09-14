import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const RED = '#890000';

type RawItem = {
  id: number; name: string; description: string; price: number;
  promotional_price_active: boolean; promotional_price: number | null;
  status: string; position: number; highlighted: boolean; badge: string | null;
  thumbnail_url: string | null; image_url: string | null;
  add_ons: { id: number; name: string; minimum_quantity: number; maximum_quantity: number; subitems: { name: string; price: number }[] }[];
};
type RawCat = { id: number; name: string; items: RawItem[] };

async function main() {
  const raw: RawCat[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'rincao-data.json'), 'utf8').replace(/^\uFEFF/, '')
  );

  // ---------- Restaurante (dados reais da referência) ----------
  await prisma.restaurant.upsert({
    where: { id: 'single' },
    update: {},
    create: {
      id: 'single',
      name: 'Rincão Lanches',
      logoUrl: 'https://storage.googleapis.com/prod-cardapio-web/uploads/company/logo/62454/ca537df3IMG_5351.PNG',
      bannerUrl: 'https://storage.googleapis.com/prod-cardapio-web/uploads/company/image/62454/f1d985ffIMG_5351.PNG',
      phone: '(55) 98437-5004',
      whatsapp: process.env.RESTAURANT_WHATSAPP || '5555984375004',
      address: 'Av. Dom Pedro II, 1694 - Umbu, Sant\'Ana do Livramento/RS (Próx. Trevo da Brasília)',
      pixKey: '(55) 98437-5004',
      deliveryFee: 6,
      minOrder: 0,
      prepTimeMin: 40,
      payments: JSON.stringify(['pix', 'dinheiro', 'debito', 'credito']),
      hoursJson: JSON.stringify({
        seg: ['00:00-01:00', '19:00-23:59'],
        ter: ['19:00-23:59'],
        qua: ['19:00-23:59'],
        qui: ['19:00-23:59'],
        sex: ['19:00-23:59'],
        sab: ['00:00-01:00', '19:00-23:59'],
        dom: [],
      }),
    },
  });

  // ---------- Usuários ----------
  const users: [string, string, string][] = [
    ['Administrador', 'admin@rincao.com', 'admin'],
    ['Cozinha', 'cozinha@rincao.com', 'cozinha'],
    ['Caixa', 'caixa@rincao.com', 'caixa'],
    ['Entregador', 'entregador@rincao.com', 'entregador'],
  ];
  for (const [name, email, role] of users) {
    await prisma.user.upsert({
      where: { email }, update: {},
      create: { name, email, passwordHash: await bcrypt.hash(role === 'admin' ? 'admin123' : '123456', 10), role },
    });
  }

  // ---------- Categorias + Produtos (reais) ----------
  const catIdByName: Record<string, string> = {};
  for (let i = 0; i < raw.length; i++) {
    const c = await prisma.category.upsert({
      where: { id: `rcat-${i}` }, update: { name: raw[i].name, order: i },
      create: { id: `rcat-${i}`, name: raw[i].name, order: i },
    });
    catIdByName[raw[i].name] = c.id;
  }

  // grupos de sabores das pizzas (reais: min/max)
  const pizzaGroups: Record<string, string> = {};
  const pizzaDefs = [
    { key: '2', item: 'PIZZA 30CM (2 SABORES)' },
    { key: '3', item: 'PIZZA G 35CM (3 SABORES)' },
    { key: '4', item: 'PIZZA GG 40CM (4 SABORES)' },
  ];
  const flavorNames = ['Escolha os 2 sabores', 'Escolha os 3 sabores', 'Escolha os 4 sabores'];
  for (let k = 0; k < pizzaDefs.length; k++) {
    const all = raw.flatMap((c) => c.items);
    const ref = all.find((x) => x.name === pizzaDefs[k].item);
    const ao = ref?.add_ons?.[0];
    const g = await prisma.addonGroup.upsert({
      where: { id: `rg-pizza${pizzaDefs[k].key}` }, update: {},
      create: {
        id: `rg-pizza${pizzaDefs[k].key}`,
        name: ao?.name || flavorNames[k],
        minSel: ao?.minimum_quantity ?? 1,
        maxSel: ao?.maximum_quantity ?? Number(pizzaDefs[k].key),
        required: (ao?.minimum_quantity ?? 1) >= 1,
      },
    });
    pizzaGroups[pizzaDefs[k].item] = g.id;
    const flavors = ao?.subitems || [];
    await prisma.addon.deleteMany({ where: { groupId: g.id } });
    for (const s of flavors)
      await prisma.addon.create({ data: { groupId: g.id, name: s.name, price: Number(s.price || 0) } });
  }

  // grupo geral de adicionais (itens reais da categoria ADICIONAIS)
  const adCat = raw.find((c) => c.name === 'ADICIONAIS');
  const gAd = await prisma.addonGroup.upsert({
    where: { id: 'rg-adicionais' }, update: {},
    create: { id: 'rg-adicionais', name: 'Turbinar lanche (adicionais)', minSel: 0, maxSel: 8, required: false },
  });
  await prisma.addon.deleteMany({ where: { groupId: gAd.id } });
  for (const a of adCat?.items || [])
    await prisma.addon.create({ data: { groupId: gAd.id, name: a.name, price: Number(a.price || 0) } });

  // ---------- Produtos ----------
  const bebIds: string[] = [];
  for (const c of raw) {
    for (const it of c.items) {
      const pid = `r-${it.id}`;
      const promo = it.promotional_price_active && it.promotional_price ? Number(it.promotional_price) : null;
      const best = it.badge === 'best_seller' || it.highlighted;
      await prisma.product.upsert({
        where: { id: pid },
        update: {
          name: it.name, description: it.description || '', price: Number(it.price),
          promoPrice: promo, photoUrl: it.thumbnail_url || '', categoryId: catIdByName[c.name],
          available: it.status === 'ACTIVE', featured: it.highlighted, bestSeller: best, order: it.position || 0,
        },
        create: {
          id: pid, name: it.name, description: it.description || '', price: Number(it.price),
          promoPrice: promo, photoUrl: it.thumbnail_url || '', categoryId: catIdByName[c.name],
          available: it.status === 'ACTIVE', featured: it.highlighted, bestSeller: best, order: it.position || 0,
        },
      });
      if (c.name === 'BEBIDAS' && bebIds.length < 4) bebIds.push(pid);
      // vínculo pizza <-> grupo de sabores
      if (pizzaGroups[it.name]) {
        try { await prisma.productAddonGroup.create({ data: { productId: pid, groupId: pizzaGroups[it.name] } }); } catch {}
      }
    }
  }

  // upsell: lanches sugerem bebidas | vínculo adicionais -> lanches
  const snackCats = ['XIS', 'TORRADAS', 'CACHORRO QUENTE', 'PASTÉIS', 'COMBOS', 'CAIXAS E TÁBUAS'];
  const snacks = await prisma.product.findMany({
    where: { category: { name: { in: snackCats } } }, select: { id: true },
  });
  for (const s of snacks) {
    await prisma.product.update({ where: { id: s.id }, data: { relatedIds: JSON.stringify(bebIds.slice(0, 2)) } });
    try { await prisma.productAddonGroup.create({ data: { productId: s.id, groupId: gAd.id } }); } catch {}
  }

  // ---------- Cupons / promo ----------
  await prisma.coupon.upsert({ where: { code: 'BEMVINDO10' }, update: {}, create: { code: 'BEMVINDO10', kind: 'percent', value: 10, minValue: 20, maxUses: 200, firstOnly: true } });
  await prisma.coupon.upsert({ where: { code: 'RINCAO5' }, update: {}, create: { code: 'RINCAO5', kind: 'fixed', value: 5, minValue: 40, maxUses: 100 } });
  await prisma.promotion.upsert({ where: { id: 'promo1' }, update: {}, create: { id: 'promo1', title: 'Os Mais Pedidos', kind: 'percent', value: 0 } });

  // ---------- Mesas / entregador / estoque ----------
  for (let i = 1; i <= 8; i++)
    await prisma.tableMap.upsert({ where: { number: `Mesa ${String(i).padStart(2, '0')}` }, update: {}, create: { number: `Mesa ${String(i).padStart(2, '0')}` } });
  await prisma.driver.upsert({ where: { id: 'drv1' }, update: {}, create: { id: 'drv1', name: 'Entregador Rincão', phone: '(55) 98437-5004' } });
  const inv: [string, string, number, number][] = [
    ['Pão de xis', 'un', 80, 20], ['Bife de filé', 'kg', 10, 3], ['Frango', 'kg', 8, 2],
    ['Bacon', 'kg', 5, 1], ['Mussarela', 'kg', 6, 2], ['Presunto', 'kg', 4, 1],
    ['Batata', 'kg', 15, 5], ['Refrigerante lata', 'un', 60, 12], ['Ovos', 'un', 60, 12],
  ];
  for (const [n, u, q, m] of inv) {
    try { await prisma.inventoryItem.create({ data: { name: n, unit: u, qty: q, minQty: m } }); } catch {}
  }

  const nProd = await prisma.product.count();
  console.log(`Seed Rincão OK (${nProd} produtos). Cor tema: ${RED}. Login: admin@rincao.com / admin123`);
}
main().finally(() => prisma.$disconnect());
