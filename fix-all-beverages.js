const { PrismaClient } = require('@prisma/client');
const https = require('https');
const prisma = new PrismaClient();

// ALL beverages EXCEPT Fanta and Sprite - with verified barcodes
const beverages = [
  { id: 'r-4777842', name: 'ÁGUA C/GÁS', barcodes: ['7894900531008', '7891100002507'] },
  { id: 'r-4777843', name: 'ÁGUA S/GÁS', barcodes: ['7894900530001', '7891100002514'] },
  { id: 'r-4777844', name: 'ÁGUA TÔNICA SEM AÇÚCAR', barcodes: ['7894900300017'] },
  { id: 'r-4777845', name: 'SCHWEPPES LATA 350ML', barcodes: ['7894900300048', '7894900300017'] },
  { id: 'r-4777846', name: 'SCHWEPPES CITRUS 350ML', barcodes: ['7894900320015'] },
  { id: 'r-4777847', name: 'BADWEISER GFA 990ML', barcodes: ['7891991011518', '7891991294652'] },
  { id: 'r-4777848', name: 'CERVEJA AMSTEL', barcodes: ['7896045504831', '8606105157513'] },
  { id: 'r-4777849', name: 'CERVEJA ANTÁRCTICA LATÃO', barcodes: ['7891991295017', '7891991015493'] },
  { id: 'r-4777850', name: 'CERVEJA ANTÁRCTICA SUBZERO', barcodes: ['7891991010023', '7891991010900'] },
  { id: 'r-4777851', name: 'CERVEJA BRAHMA 0% ÁLCOOL 350 ML', barcodes: ['7891149104932', '7891149105502'] },
  { id: 'r-4777852', name: 'CERVEJA BRAHMA 1L', barcodes: ['7891149010509', '7891149104109'] },
  { id: 'r-4777853', name: 'CERVEJA BADWEISER LATA', barcodes: ['7891991010481', '7891991294621'] },
  { id: 'r-4777854', name: 'CERVEJA SKOL 1L', barcodes: ['7891149102853', '7891149108015'] },
  { id: 'r-4777855', name: 'CERVEJA SKOL LATÃO', barcodes: ['7891149100187', '7891149102150'] },
  { id: 'r-4777856', name: 'COCA COLA 1L', barcodes: ['7894900011517'] },
  { id: 'r-4777857', name: 'COCA COLA 2L', barcodes: ['7894900011517'] },
  { id: 'r-4777858', name: 'COCA COLA 600ML', barcodes: ['7894900016062', '7894900010015'] },
  { id: 'r-4777859', name: 'COCA COLA 350ML', barcodes: ['7894900016352', '7894900011326'] },
  { id: 'r-4777865', name: 'GUARANÁ ANTÁRTICA 1L', barcodes: ['7891991000826', '7891991009737'] },
  { id: 'r-4777866', name: 'GUARANÁ ANTÁRTICA 2L', barcodes: ['7891991001342', '7891991009751'] },
  { id: 'r-4777867', name: 'GUARANÁ ANTÁRTICA 350ML', barcodes: ['7891991009720', '7891991000826'] },
  { id: 'r-4777869', name: 'PEPSI ORIGINAL 350ML', barcodes: ['7892840800079'] },
  { id: 'r-4777873', name: 'SUCO DEL VALLE', barcodes: ['7894900611090', '7894900611106'] },
  { id: 'r-5036624', name: 'ENERGÉTICO BALLY 2L', barcodes: ['7898080662668'] },
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
  const desc = product.generic_name_pt || product.generic_name || '';
  return { photoUrl, description: desc, name: product.product_name || '' };
}

async function main() {
  console.log('=== Replacing all beverage images (except Fanta/Sprite) ===\n');
  const results = { updated: 0, failed: 0 };

  for (let i = 0; i < beverages.length; i++) {
    const bev = beverages[i];
    try {
      console.log(`[${i + 1}/${beverages.length}] ${bev.name}`);
      let found = null;

      for (const barcode of bev.barcodes) {
        const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,generic_name_pt,generic_name,image_front_url,image_url,images`;
        try {
          const { status, data } = await fetchJSON(url);
          if (status === 200 && data?.product) {
            const info = extractImage(data.product);
            if (info?.photoUrl) {
              found = info;
              console.log(`  ✓ ${barcode}: "${info.name}"`);
              break;
            }
          }
        } catch (e) { console.log(`  ! ${barcode}: ${e.message}`); }
        await sleep(2500);
      }

      if (found?.photoUrl) {
        await prisma.product.update({
          where: { id: bev.id },
          data: { photoUrl: found.photoUrl, ...(found.description ? { description: found.description } : {}) },
        });
        console.log(`  ✅ Updated`);
        results.updated++;
      } else {
        console.log(`  ⚠️ No image`);
        results.failed++;
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      results.failed++;
    }
    await sleep(2500);
  }

  console.log(`\n=== ${results.updated} updated, ${results.failed} failed ===`);
  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
