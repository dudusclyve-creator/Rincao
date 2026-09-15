const { PrismaClient } = require('@prisma/client');
const https = require('https');
const prisma = new PrismaClient();

const items = [
  { id: 'r-4777847', name: 'BADWEISER GFA 990ML', barcodes: ['7891991011518', '7891991294652', '7891991010481'] },
  { id: 'r-4777853', name: 'CERVEJA BADWEISER LATA', barcodes: ['7891991010481', '7891991294621', '0728800380504'] },
];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: null }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractImage(product) {
  if (!product) return null;
  let photoUrl = product.image_front_url || product.image_url || '';
  if (!photoUrl && product.images) {
    const keys = Object.keys(product.images);
    const fk = keys.find(k => k.startsWith('front'));
    if (fk && product.images[fk]) photoUrl = product.images[fk].display_url || product.images[fk].thumb_url || '';
    if (!photoUrl && keys.length > 0) photoUrl = product.images[keys[0]].display_url || '';
  }
  if (photoUrl && !photoUrl.startsWith('http')) photoUrl = 'https://images.openfoodfacts.org' + photoUrl;
  return { photoUrl, description: product.generic_name_pt || product.generic_name || '', name: product.product_name || '' };
}

async function searchOFF(term) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&fields=code,product_name,generic_name_pt,generic_name,image_front_url,image_url,images&page_size=10&sort_by=unique_scans_n`;
  const { status, data } = await fetchJSON(url);
  if (status === 200 && data?.products) return data.products;
  return [];
}

async function main() {
  for (const item of items) {
    console.log(`\n=== ${item.name} ===`);
    
    // Try barcodes
    for (const barcode of item.barcodes) {
      console.log(`  Trying barcode ${barcode}...`);
      try {
        const { status, data } = await fetchJSON(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,generic_name_pt,generic_name,image_front_url,image_url,images`);
        if (status === 200 && data?.product) {
          const info = extractImage(data.product);
          if (info?.photoUrl) {
            console.log(`  ✓ Found: "${info.name}" -> ${info.photoUrl.substring(0, 70)}...`);
            await prisma.product.update({ where: { id: item.id }, data: { photoUrl: info.photoUrl, ...(info.description ? { description: info.description } : {}) } });
            console.log(`  ✅ Updated`);
            break;
          }
        }
      } catch (e) { console.log(`  ! Error: ${e.message}`); }
      await sleep(3000);
    }

    // If still no result, try search
    const current = await prisma.product.findUnique({ where: { id: item.id }, select: { photoUrl: true } });
    if (!current?.photoUrl) {
      console.log(`  Trying search...`);
      const products = await searchOFF(item.name === 'BADWEISER GFA 990ML' ? 'budweiser 990' : 'budweiser lata');
      for (const p of products) {
        const info = extractImage(p);
        if (info?.photoUrl) {
          console.log(`  ✓ Search found: "${info.name}"`);
          await prisma.product.update({ where: { id: item.id }, data: { photoUrl: info.photoUrl, ...(info.description ? { description: info.description } : {}) } });
          console.log(`  ✅ Updated`);
          break;
        }
        await sleep(1000);
      }
    }
    await sleep(3000);
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
