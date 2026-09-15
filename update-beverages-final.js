const { PrismaClient } = require('@prisma/client');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();

const beverages = [
  { id: 'r-4777842', name: 'ÁGUA C/GÁS', barcodes: ['7894900531008', '7891100002507', '7896065870497'] },
  { id: 'r-4777843', name: 'ÁGUA S/GÁS', barcodes: ['7894900530001', '7891100002514', '7896062800121'] },
  { id: 'r-4777844', name: 'ÁGUA TÔNICA SEM AÇÚCAR', barcodes: ['7894900300017'] },
  { id: 'r-4777845', name: 'SCHWEPPES LATA 350ML', barcodes: ['7894900300048'] },
  { id: 'r-4777846', name: 'SCHWEPPES CITRUS 350ML', barcodes: ['7894900320015'] },
  { id: 'r-4777847', name: 'BADWEISER GFA 990ML', barcodes: ['7891991011518', '7891991294652'] },
  { id: 'r-4777848', name: 'CERVEJA AMSTEL', barcodes: ['7896045504831', '7896045504824'] },
  { id: 'r-4777849', name: 'CERVEJA ANTÁRCTICA LATÃO', barcodes: ['7891991295017', '7891991015493'] },
  { id: 'r-4777850', name: 'CERVEJA ANTÁRCTICA SUBZERO', barcodes: ['7891991010023', '7891991010900'] },
  { id: 'r-4777851', name: 'CERVEJA BRAHMA 0% ÁLCOOL 350 ML', barcodes: ['7891149104932', '7891149105502'] },
  { id: 'r-4777852', name: 'CERVEJA BRAHMA 1L', barcodes: ['7891149010509', '7891149104109'] },
  { id: 'r-4777853', name: 'CERVEJA BADWEISER LATA', barcodes: ['7891991010481', '7891991294621'] },
  { id: 'r-4777854', name: 'CERVEJA SKOL 1L', barcodes: ['7891149102853', '7891149108015'] },
  { id: 'r-4777855', name: 'CERVEJA SKOL LATÃO', barcodes: ['7891149100187', '7891149102150'] },
  { id: 'r-4777856', name: 'COCA COLA 1L', barcodes: ['7894900011517', '7894900701739'] },
  { id: 'r-4777857', name: 'COCA COLA 2L', barcodes: ['7894900011517'] },
  { id: 'r-4777858', name: 'COCA COLA 600ML', barcodes: ['7894900010015', '7894900016062'] },
  { id: 'r-4777859', name: 'COCA COLA 350ML', barcodes: ['7894900016352', '7894900010015'] },
  { id: 'r-4777860', name: 'FANTA LATA 350ML', barcodes: ['7894900030013'] },
  { id: 'r-4777861', name: 'FANTA LATA 210ML', barcodes: ['7894900030396'] },
  { id: 'r-4777862', name: 'FANTA 2L', barcodes: ['7894900031515'] },
  { id: 'r-4777863', name: 'FANTA 600ML', barcodes: ['7894900031607'] },
  { id: 'r-4777864', name: 'FANTA UVA 350ML', barcodes: ['7894900059847'] },
  { id: 'r-4777865', name: 'GUARANÁ ANTÁRTICA 1L', barcodes: ['7891991000826'] },
  { id: 'r-4777866', name: 'GUARANÁ ANTÁRTICA 2L', barcodes: ['7891991001342', '7891991009751'] },
  { id: 'r-4777867', name: 'GUARANÁ ANTÁRTICA 350ML', barcodes: ['7891991009720', '7891991000826'] },
  { id: 'r-4777868', name: 'GUARANÁ ANTÁRTICA 600ML', barcodes: ['7891991002646'] },
  { id: 'r-4777869', name: 'PEPSI ORIGINAL 350ML', barcodes: ['7892840800079'] },
  { id: 'r-4777870', name: 'SPRITE 2L', barcodes: ['7894900681024'] },
  { id: 'r-4777871', name: 'SPRITE 350ML', barcodes: ['7894900681017'] },
  { id: 'r-4777872', name: 'SPRITE 600ML', barcodes: ['7894900681246'] },
  { id: 'r-4777873', name: 'SUCO DEL VALLE', barcodes: ['7894900611090', '7894900611106'] },
  { id: 'r-5036624', name: 'ENERGÉTICO BALLY 2L', barcodes: ['7898080662668'] },
];

function fetchJSON(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const doAttempt = (attempt) => {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, {
        headers: { 'User-Agent': 'RincaoLanches/1.0', 'Accept': 'application/json' }
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return fetchJSON(res.headers.location, retries).then(resolve, reject);
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if ((res.statusCode === 503 || res.statusCode === 429) && attempt < retries) {
            setTimeout(() => doAttempt(attempt + 1), 5000 * (attempt + 1));
            return;
          }
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data: null }); }
        });
      });
      req.on('error', (err) => {
        if (attempt < retries) setTimeout(() => doAttempt(attempt + 1), 3000);
        else reject(err);
      });
      req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
    };
    doAttempt(0);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractImage(product) {
  if (!product) return null;
  let photoUrl = product.image_front_url || product.image_url || '';
  if (!photoUrl && product.images) {
    const keys = Object.keys(product.images);
    const frontKey = keys.find(k => k.startsWith('front'));
    if (frontKey && product.images[frontKey]) {
      photoUrl = product.images[frontKey].display_url || product.images[frontKey].thumb_url || '';
    }
    if (!photoUrl && keys.length > 0) {
      photoUrl = product.images[keys[0]].display_url || '';
    }
  }
  if (photoUrl && !photoUrl.startsWith('http')) {
    photoUrl = 'https://images.openfoodfacts.org' + photoUrl;
  }
  const desc = product.generic_name_pt || product.generic_name || '';
  return { photoUrl, description: desc, name: product.product_name || '' };
}

async function main() {
  console.log('=== Final update: correct EAN barcodes ===\n');
  const results = { updated: 0, failed: 0, total: beverages.length };

  for (let i = 0; i < beverages.length; i++) {
    const bev = beverages[i];
    try {
      console.log(`[${i + 1}/${beverages.length}] ${bev.name}`);

      let found = null;

      for (const barcode of bev.barcodes) {
        const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,generic_name_pt,generic_name,image_front_url,image_url,images`;
        try {
          const { status, data } = await fetchJSON(url);
          if (status === 200 && data && data.product) {
            const info = extractImage(data.product);
            if (info && info.photoUrl) {
              found = info;
              console.log(`  ✓ Barcode ${barcode}: "${info.name}"`);
              break;
            }
          }
        } catch (e) {
          console.log(`  ! Barcode ${barcode}: ${e.message}`);
        }
        await sleep(2500);
      }

      if (found && found.photoUrl) {
        await prisma.product.update({
          where: { id: bev.id },
          data: {
            photoUrl: found.photoUrl,
            ...(found.description ? { description: found.description } : {}),
          },
        });
        console.log(`  ✅ Updated`);
        results.updated++;
      } else {
        console.log(`  ⚠️ No image found from any barcode`);
        results.failed++;
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      results.failed++;
    }
    await sleep(2500);
  }

  console.log(`\n=== RESULT: ${results.updated}/${results.total} updated, ${results.failed} failed ===`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
