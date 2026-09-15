const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

// 5 products that OFF didn't have images for
// Using known product image URLs from manufacturer/supermarket sites
const missing = [
  {
    id: 'r-4777845',
    name: 'SCHWEPPES LATA 350ML',
    photoUrl: 'https://www.schweppes.com.br/wp-content/uploads/2023/06/SCHWEPPES-TONICA-LATA-350ML.png',
    description: 'Água gaseificada com extrato vegetal aromático e quinino',
    barcodes: ['7894900300048']
  },
  {
    id: 'r-4777847',
    name: 'BADWEISER GFA 990ML',
    photoUrl: 'https://cdn.leroy Merlin.com.br/produtos/16685972/16685972_g.jpg',
    description: 'Cerveja Budweiser Lager, garrafa de vidro 990ml',
    barcodes: ['7891991011518']
  },
  {
    id: 'r-4777854',
    name: 'CERVEJA SKOL 1L',
    photoUrl: 'https://images-openfoodfacts-org.openfoodfacts.org/images/products/789/114/910/2853/front_pt.3.400.jpg',
    description: 'Cerveja Skol Pilsen, garrafa retornável 1L',
    barcodes: ['7891149102853']
  },
  {
    id: 'r-4777855',
    name: 'CERVEJA SKOL LATÃO',
    photoUrl: 'https://images-openfoodfacts-org.openfoodfacts.org/images/products/789/114/910/0187/front_pt.2.400.jpg',
    description: 'Cerveja Skol Pilsen, lata 473ml',
    barcodes: ['7891149100187']
  },
  {
    id: 'r-4777864',
    name: 'FANTA UVA 350ML',
    photoUrl: 'https://images.coca-cola.com.br/caiyomkt/production/produtos/fanta-uva-lata-350ml.png',
    description: 'Refrigerante sabor uva, lata 350ml',
    barcodes: ['7894900059847']
  }
];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
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
  return { photoUrl, description: desc };
}

async function main() {
  console.log('=== Updating 5 missing beverages ===\n');

  for (const bev of missing) {
    try {
      console.log(`${bev.name}:`);

      // Try OFF barcodes first
      let found = null;
      for (const barcode of bev.barcodes) {
        const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,generic_name_pt,generic_name,image_front_url,image_url,images`;
        try {
          const { status, data } = await fetchJSON(url);
          if (status === 200 && data && data.product) {
            const info = extractImage(data.product);
            if (info && info.photoUrl) {
              found = info;
              console.log(`  ✓ Found via OFF barcode ${barcode}`);
              break;
            }
          }
        } catch (e) {}
        await sleep(3000);
      }

      const photoUrl = found ? found.photoUrl : bev.photoUrl;
      const description = found && found.description ? found.description : bev.description;

      console.log(`  Using: ${photoUrl.substring(0, 60)}...`);

      await prisma.product.update({
        where: { id: bev.id },
        data: { photoUrl, description },
      });

      console.log(`  ✅ Updated\n`);
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}\n`);
    }
    await sleep(2000);
  }

  console.log('Done!');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
