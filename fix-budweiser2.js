const { PrismaClient } = require('@prisma/client');
const https = require('https');
const prisma = new PrismaClient();

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

async function main() {
  // Search specifically for Budweiser 990ml garrafa
  const searches = [
    { id: 'r-4777847', terms: ['budweiser 990', 'budweiser garrafa 990', 'budweiser long neck'] },
  ];

  for (const item of searches) {
    console.log(`\n=== ${item.id} ===`);
    for (const term of item.terms) {
      console.log(`  Searching: "${term}"`);
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&fields=code,product_name,generic_name_pt,generic_name,image_front_url,image_url,images&page_size=5&sort_by=unique_scans_n`;
      try {
        const { status, data } = await fetchJSON(url);
        if (status === 200 && data?.products) {
          for (const p of data.products) {
            const name = (p.product_name || '').toLowerCase();
            const desc = (p.generic_name_pt || p.generic_name || '').toLowerCase();
            console.log(`    Found: "${p.product_name}" (code: ${p.code})`);
            if (p.image_front_url || p.image_url) {
              const photoUrl = p.image_front_url || p.image_url;
              console.log(`    ✓ Image: ${photoUrl.substring(0, 70)}...`);
              const description = p.generic_name_pt || p.generic_name || '';
              await prisma.product.update({ where: { id: item.id }, data: { photoUrl, ...(description ? { description } : {}) } });
              console.log(`    ✅ Updated!`);
              break;
            }
          }
        }
      } catch (e) { console.log(`    ! Error: ${e.message}`); }
      await sleep(3000);
    }
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
