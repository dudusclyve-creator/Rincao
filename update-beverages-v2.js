const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

const beverages = [
  { id: 'r-4777842', searchTerm: 'água mineral com gás garrafa' },
  { id: 'r-4777843', searchTerm: 'água mineral sem gás garrafa' },
  { id: 'r-4777844', searchTerm: 'schweppes tônica' },
  { id: 'r-4777845', searchTerm: 'schweppes tonic' },
  { id: 'r-4777846', searchTerm: 'schweppes citrus' },
  { id: 'r-4777847', searchTerm: 'budweiser beer' },
  { id: 'r-4777848', searchTerm: 'amstel beer' },
  { id: 'r-4777849', searchTerm: 'antarctica original lata' },
  { id: 'r-4777850', searchTerm: 'antarctica subzero' },
  { id: 'r-4777851', searchTerm: 'brahma 0' },
  { id: 'r-4777852', searchTerm: 'brahma 1l' },
  { id: 'r-4777853', searchTerm: 'budweiser lata' },
  { id: 'r-4777854', searchTerm: 'skol 1l' },
  { id: 'r-4777855', searchTerm: 'skol lata' },
  { id: 'r-4777856', searchTerm: 'coca-cola 1l' },
  { id: 'r-4777857', searchTerm: 'coca-cola 2l' },
  { id: 'r-4777858', searchTerm: 'coca-cola 600ml' },
  { id: 'r-4777859', searchTerm: 'coca-cola lata 350ml' },
  { id: 'r-4777860', searchTerm: 'fanta laranja lata 350ml' },
  { id: 'r-4777861', searchTerm: 'fanta laranja lata 210ml' },
  { id: 'r-4777862', searchTerm: 'fanta laranja 2l' },
  { id: 'r-4777863', searchTerm: 'fanta laranja 600ml' },
  { id: 'r-4777864', searchTerm: 'fanta uva 350ml' },
  { id: 'r-4777865', searchTerm: 'guaraná antarctica 1l' },
  { id: 'r-4777866', searchTerm: 'guaraná antarctica 2l' },
  { id: 'r-4777867', searchTerm: 'guaraná antarctica lata 350' },
  { id: 'r-4777868', searchTerm: 'guaraná antarctica 600ml' },
  { id: 'r-4777869', searchTerm: 'pepsi lata 350ml' },
  { id: 'r-4777870', searchTerm: 'sprite 2l' },
  { id: 'r-4777871', searchTerm: 'sprite lata 350ml' },
  { id: 'r-4777872', searchTerm: 'sprite 600ml' },
  { id: 'r-4777873', searchTerm: 'del valle' },
  { id: 'r-5036624', searchTerm: 'bally energético' },
];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'RincaoLanches/1.0 (contato@rincao.com.br)',
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

function getBestImage(product) {
  if (!product) return null;

  // OFF images structure: product.images is an object with numeric keys
  // Each image has: thumb_url, small_url, display_url
  // We want the front image, preferably with white background
  // Key "front" is the selected front image
  
  let bestUrl = '';
  
  // Method 1: image_front_url (curated best front image)
  if (product.image_front_url) {
    bestUrl = product.image_front_url;
  }
  // Method 2: image_url (main image)
  else if (product.image_url) {
    bestUrl = product.image_url;
  }
  // Method 3: dig into images map
  else if (product.images) {
    const keys = Object.keys(product.images);
    // Find front images
    const frontKey = keys.find(k => k.startsWith('front'));
    if (frontKey && product.images[frontKey]) {
      const img = product.images[frontKey];
      bestUrl = img.display_url || img.small_url || img.thumb_url || '';
    }
    // Fallback to first image
    if (!bestUrl && keys.length > 0) {
      const img = product.images[keys[0]];
      bestUrl = img.display_url || img.small_url || img.thumb_url || '';
    }
  }

  if (bestUrl && !bestUrl.startsWith('http')) {
    bestUrl = 'https://images.openfoodfacts.org' + bestUrl;
  }

  // Make image bigger (replace thumb/small sizes)
  if (bestUrl) {
    bestUrl = bestUrl.replace(/\/(\d+)x(\d+)\//, '/500x500/');
    // Also handle .500. size pattern
    if (!bestUrl.includes('500x500')) {
      bestUrl = bestUrl.replace(/front_[^.]+\.(\d+)\./, 'front_$1.500.');
    }
  }

  const desc = product.generic_name_pt || product.generic_name || '';
  
  return { photoUrl: bestUrl, description: desc, barcode: product.code || '', name: product.product_name || '' };
}

async function main() {
  console.log('=== Buscando imagens corretas por nome no Open Food Facts ===\n');
  
  const results = { updated: 0, notfound: 0, failed: 0 };

  for (let i = 0; i < beverages.length; i++) {
    const bev = beverages[i];
    try {
      console.log(`[${i + 1}/${beverages.length}] ${bev.id} - Buscando: "${bev.searchTerm}"`);

      // Use OFF search API
      const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(bev.searchTerm)}&search_simple=1&action=process&json=1&fields=code,product_name,generic_name_pt,generic_name,image_front_url,image_url,images&page_size=5&sort_by=unique_scans_n`;
      
      const { status, data } = await fetchJSON(searchUrl);
      
      if (status !== 200 || !data || !data.products || data.products.length === 0) {
        console.log(`  ⚠️ Nenhum resultado encontrado (HTTP ${status})`);
        results.notfound++;
        await sleep(2000);
        continue;
      }

      // Find best match - prefer products with images
      let bestProduct = null;
      let bestScore = -1;

      for (const p of data.products) {
        const info = getBestImage(p);
        if (!info || !info.photoUrl) continue;
        
        // Score: has image + has description + has barcode
        let score = 0;
        if (info.photoUrl) score += 10;
        if (info.description) score += 5;
        if (info.barcode) score += 3;
        
        // Boost score if name matches more closely
        const pName = (p.product_name || '').toLowerCase();
        const searchLower = bev.searchTerm.toLowerCase();
        const words = searchLower.split(/\s+/);
        const matchWords = words.filter(w => pName.includes(w));
        score += matchWords.length * 2;

        if (score > bestScore) {
          bestScore = score;
          bestProduct = { product: p, info };
        }
      }

      if (!bestProduct) {
        console.log(`  ⚠️ Nenhum produto com imagem encontrado`);
        results.notfound++;
        await sleep(2000);
        continue;
      }

      const { info } = bestProduct;
      console.log(`  ✓ Encontrado: "${info.name}" (EAN: ${info.barcode})`);
      console.log(`    Imagem: ${info.photoUrl.substring(0, 80)}...`);

      await prisma.product.update({
        where: { id: bev.id },
        data: {
          photoUrl: info.photoUrl,
          ...(info.description ? { description: info.description } : {}),
        },
      });

      console.log(`  ✅ Atualizado com sucesso`);
      results.updated++;
    } catch (err) {
      console.log(`  ❌ Erro: ${err.message}`);
      results.failed++;
    }

    // Rate limit: wait between requests
    await sleep(2000);
  }

  console.log('\n========================================');
  console.log('RESUMO');
  console.log('========================================');
  console.log(`✅ Atualizados: ${results.updated}`);
  console.log(`⚠️ Não encontrados: ${results.notfound}`);
  console.log(`❌ Erros: ${results.failed}`);
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
