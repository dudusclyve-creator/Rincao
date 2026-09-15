const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

// Products that failed or got wrong results in v2
const beverages = [
  { id: 'r-4777842', searchTerm: 'agua con gas', barcode: '7891100002507' },
  { id: 'r-4777843', searchTerm: 'agua sin gas', barcode: '7891100002514' },
  { id: 'r-4777844', searchTerm: 'schweppes tonica zero', barcode: '7894900300017' },
  { id: 'r-4777847', searchTerm: 'budweiser', barcode: '7891991294652' },
  { id: 'r-4777848', searchTerm: 'amstel', barcode: '7896045504831' },
  { id: 'r-4777849', searchTerm: 'antarctica original', barcode: '7891991295017' },
  { id: 'r-4777850', searchTerm: 'antarctica subzero', barcode: '7891991010023' },
  { id: 'r-4777852', searchTerm: 'brahma chopp', barcode: '7891149010509' },
  { id: 'r-4777853', searchTerm: 'budweiser lata 350', barcode: '7891991294621' },
  { id: 'r-4777854', searchTerm: 'skol', barcode: '7891149108015' },
  { id: 'r-4777855', searchTerm: 'skol', barcode: '7891149102150' },
  { id: 'r-4777857', searchTerm: 'coca-cola 2 litros', barcode: '7894900011517' },
  { id: 'r-4777861', searchTerm: 'fanta laranja mini', barcode: '7894900039863' },
  { id: 'r-4777864', searchTerm: 'fanta uva', barcode: '7894900059847' },
  { id: 'r-4777865', searchTerm: 'guarana antarctica 1l', barcode: '7891991000826' },
  { id: 'r-4777866', searchTerm: 'guarana antarctica 2l', barcode: '7891991009751' },
  { id: 'r-4777867', searchTerm: 'guarana antarctica lata', barcode: '7891991000826' },
  { id: 'r-4777869', searchTerm: 'pepsi', barcode: '7892840800079' },
  { id: 'r-4777873', searchTerm: 'del valle uva', barcode: '7894900611090' },
  { id: 'r-5036624', searchTerm: 'bally', barcode: '' },
];

// Also fix wrong images from v1
const fixWrong = [
  { id: 'r-4777845', barcode: '7894900300048' },  // Schweppes Tônica 350ml
];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'RincaoLanches/1.0',
        'Accept': 'application/json',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location).then(resolve, reject);
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: null }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractBestImage(product) {
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
  return { photoUrl, description: desc, name: product.product_name || '', code: product.code || '' };
}

async function searchByName(term) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&fields=code,product_name,generic_name_pt,generic_name,image_front_url,image_url,images&page_size=5&sort_by=unique_scans_n`;
  try {
    const { status, data } = await fetchJSON(url);
    if (status === 200 && data && data.products && data.products.length > 0) {
      return data.products;
    }
  } catch (e) {}
  return [];
}

async function lookupBarcode(barcode) {
  if (!barcode) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,generic_name_pt,generic_name,image_front_url,image_url,images`;
  try {
    const { status, data } = await fetchJSON(url);
    if (status === 200 && data && data.product) return data.product;
  } catch (e) {}
  return null;
}

async function main() {
  console.log('=== Retry: buscando imagens corretas ===\n');

  const allItems = [...beverages, ...fixWrong];
  const results = { updated: 0, failed: 0 };

  for (let i = 0; i < allItems.length; i++) {
    const bev = allItems[i];
    try {
      console.log(`[${i + 1}/${allItems.length}] ${bev.id} - ${bev.barcode || bev.searchTerm}`);

      let found = null;

      // Try barcode first
      if (bev.barcode) {
        const product = await lookupBarcode(bev.barcode);
        if (product) {
          found = extractBestImage(product);
          if (found) console.log(`  ✓ Found via barcode ${bev.barcode}`);
        }
        await sleep(3000);
      }

      // If barcode didn't work, try search
      if (!found || !found.photoUrl) {
        const products = await searchByName(bev.searchTerm);
        for (const p of products) {
          const info = extractBestImage(p);
          if (info && info.photoUrl) {
            found = info;
            console.log(`  ✓ Found via search: "${info.name}"`);
            break;
          }
        }
        await sleep(3000);
      }

      if (found && found.photoUrl) {
        await prisma.product.update({
          where: { id: bev.id },
          data: {
            photoUrl: found.photoUrl,
            ...(found.description ? { description: found.description } : {}),
          },
        });
        console.log(`  ✅ Updated: ${found.photoUrl.substring(0, 60)}...`);
        results.updated++;
      } else {
        console.log(`  ⚠️ No image found`);
        results.failed++;
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      results.failed++;
    }

    await sleep(3000);
  }

  console.log(`\n✅ Updated: ${results.updated} | ❌ Failed: ${results.failed}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
