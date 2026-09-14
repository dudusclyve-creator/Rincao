const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

const beverages = [
  { id: 'r-4777842', name: 'AGUA C/GAS', barcodes: ['7893604600012', '7898286720013'] },
  { id: 'r-4777843', name: 'AGUA S/GAS', barcodes: ['7898286720020', '7891149010103'] },
  { id: 'r-4777844', name: 'AGUA TONICA SEM ACUCAR', barcodes: ['7894900300017'] },
  { id: 'r-4777845', name: 'SCHWEPPES LATA 350ML', barcodes: ['7894900300017'] },
  { id: 'r-4777846', name: 'SCHWEPPES CITRUS 350ML', barcodes: ['7894900320015'] },
  { id: 'r-4777847', name: 'BADWEISER GFA 990ML', barcodes: ['7891991294652'] },
  { id: 'r-4777848', name: 'CERVEJA AMSTEL', barcodes: ['7896045504831', '8606105157513'] },
  { id: 'r-4777849', name: 'CERVEJA ANTARCTICA LATAO', barcodes: ['7891991015493', '7891991295086', '7891991009164'] },
  { id: 'r-4777850', name: 'CERVEJA ANTARCTICA SUBZERO', barcodes: ['7891991010023', '7891991010900'] },
  { id: 'r-4777851', name: 'CERVEJA BRAHMA 0% ALCOOL 350 ML', barcodes: ['7891149104932', '7891149105502'] },
  { id: 'r-4777852', name: 'CERVEJA BRAHMA 1L', barcodes: ['7891149010509', '7891149104109'] },
  { id: 'r-4777853', name: 'CERVEJA BADWEISER LATA', barcodes: ['7891991294652', '7891991294621'] },
  { id: 'r-4777854', name: 'CERVEJA SKOL 1L', barcodes: ['7891149108015', '7891149108305'] },
  { id: 'r-4777855', name: 'CERVEJA SKOL LATAO', barcodes: ['7891149102150', '7891149104123'] },
  { id: 'r-4777856', name: 'COCA COLA 1L', barcodes: ['7894900701739', '7894900011517'] },
  { id: 'r-4777857', name: 'COCA COLA 2L', barcodes: ['7894900011517'] },
  { id: 'r-4777858', name: 'COCA COLA 600ML', barcodes: ['7894900010015'] },
  { id: 'r-4777859', name: 'COCA COLA 350ML', barcodes: ['7894900010015'] },
  { id: 'r-4777860', name: 'FANTA LATA 350ML', barcodes: ['7894900039849'] },
  { id: 'r-4777861', name: 'FANTA LATA 210ML', barcodes: ['7894900039863'] },
  { id: 'r-4777862', name: 'FANTA 2L', barcodes: ['7894900031713'] },
  { id: 'r-4777863', name: 'FANTA 600ML', barcodes: ['7894900039849'] },
  { id: 'r-4777864', name: 'FANTA UVA 350ML', barcodes: ['7894900059847'] },
  { id: 'r-4777865', name: 'GUARANA ANTARTICA 1L', barcodes: ['7891991000826', '7891991009737'] },
  { id: 'r-4777866', name: 'GUARANA ANTARTICA 2L', barcodes: ['7891991000826'] },
  { id: 'r-4777867', name: 'GUARANA ANTARTICA 350ML', barcodes: ['7891991000826'] },
  { id: 'r-4777868', name: 'GUARANA ANTARTICA 600ML', barcodes: ['7891991002646'] },
  { id: 'r-4777869', name: 'PEPSI ORIGINAL 350ML', barcodes: ['7892840800079'] },
  { id: 'r-4777870', name: 'SPRITE 2L', barcodes: ['7894900069846'] },
  { id: 'r-4777871', name: 'SPRITE 350ML', barcodes: ['7894900069846'] },
  { id: 'r-4777872', name: 'SPRITE 600ML', barcodes: ['7894900063561', '7894900069846'] },
  { id: 'r-4777873', name: 'SUCO DEL VALLE', barcodes: ['7894900611090'] },
  { id: 'r-5036624', name: 'Energetico Bally 2L', barcodes: [] },
];

function fetchJSON(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const doAttempt = (attempt) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if ((res.statusCode === 503 || res.statusCode === 429) && attempt < retries) {
            setTimeout(() => doAttempt(attempt + 1), 2000 * (attempt + 1));
            return;
          }
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}: Not JSON`));
          }
        });
      });
      req.on('error', (err) => {
        if (attempt < retries) setTimeout(() => doAttempt(attempt + 1), 2000);
        else reject(err);
      });
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    };
    doAttempt(0);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lookupBarcode(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
  const { status, data } = await fetchJSON(url);
  if (status === 200 && data && data.product) {
    return data.product;
  }
  return null;
}

function extractInfo(product) {
  if (!product) return null;
  const photoUrl = product.image_front_url || product.image_url || '';
  const description = product.generic_name_pt || product.generic_name || product.product_name || '';
  if (!photoUrl && !description) return null;
  return { photoUrl, description };
}

async function main() {
  console.log('Starting beverage update script (barcode API approach)...');
  console.log(`Processing ${beverages.length} beverages\n`);

  const results = { success: 0, failed: 0, skipped: 0, errors: [] };

  for (let i = 0; i < beverages.length; i++) {
    const bev = beverages[i];
    try {
      console.log(`[${i + 1}/${beverages.length}] [${bev.id}] ${bev.name}`);

      let product = null;
      let usedBarcode = '';

      for (const barcode of bev.barcodes) {
        console.log(`  Trying barcode: ${barcode}`);
        product = await lookupBarcode(barcode);
        if (product) {
          usedBarcode = barcode;
          break;
        }
        await sleep(500);
      }

      if (!product) {
        console.log(`  ⚠️  No product found for any barcode`);
        results.skipped++;
        results.errors.push({ id: bev.id, name: bev.name, error: 'No barcode match' });
        await sleep(1000);
        continue;
      }

      const info = extractInfo(product);
      console.log(`  Found: "${product.product_name || 'unknown'}" via ${usedBarcode}`);

      if (!info) {
        console.log(`  ⚠️  No image or description available`);
        results.skipped++;
        await sleep(1000);
        continue;
      }

      console.log(`  Image: ${info.photoUrl ? 'YES' : 'NO'}`);
      console.log(`  Desc: ${info.description ? info.description.substring(0, 80) : 'none'}`);

      const updateData = {};
      if (info.photoUrl) updateData.photoUrl = info.photoUrl;
      if (info.description) updateData.description = info.description;

      await prisma.product.update({
        where: { id: bev.id },
        data: updateData,
      });

      console.log(`  ✅ Updated successfully`);
      results.success++;
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      results.failed++;
      results.errors.push({ id: bev.id, name: bev.name, error: err.message });
    }

    await sleep(1500);
  }

  console.log('\n========================================');
  console.log('RESULTS SUMMARY');
  console.log('========================================');
  console.log(`✅ Updated: ${results.success}`);
  console.log(`❌ Failed:  ${results.failed}`);
  console.log(`⚠️  Skipped: ${results.skipped}`);
  if (results.errors.length > 0) {
    console.log('\nFailed/skipped products:');
    results.errors.forEach((e) => console.log(`  - ${e.id} ${e.name}: ${e.error}`));
  }
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
