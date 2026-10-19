// Gera as imagens de marca a partir de public/logo.png:
//  - public/favicon.ico          (icone da aba do navegador)
//  - public/icon-192.png         (Android / PWA)
//  - public/icon-512.png         (Android / PWA)
//  - public/apple-touch-icon.png (iPhone / iPad)
//  - public/cardapio-og.png      (miniatura do link no WhatsApp, 1200x630)
// Rode:  node scripts/make-brand.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const src = path.join(publicDir, "logo.png");

// ---- container .ico (PNG por tamanho, igual ao scripts/make-icon.js) ----
function buildIco(pngs, dims) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = [];
  let offset = 6 + count * 16;
  for (let i = 0; i < count; i++) {
    const size = dims[i];
    const data = pngs[i];
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs]);
}

// ---- texto do card ----
const LARGURA = 1200;
const ALTURA = 630;
const VERMELHO = "#890000";

function svgFundo() {
  // fundo branco puro: a logo (que tem fundo branco) fica sem caixa aparente
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
  <rect width="${LARGURA}" height="${ALTURA}" fill="#ffffff"/>
  <rect x="0" y="0" width="${LARGURA}" height="12" fill="${VERMELHO}"/>
  <rect x="0" y="${ALTURA - 12}" width="${LARGURA}" height="12" fill="${VERMELHO}"/>
  <text x="548" y="262" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="bold" fill="${VERMELHO}">Rincão Lanches</text>
  <text x="550" y="330" font-family="Arial, Helvetica, sans-serif" font-size="46" fill="#2b2b2b">Cardápio Digital</text>
  <rect x="551" y="368" width="120" height="6" rx="3" fill="${VERMELHO}"/>
  <text x="550" y="436" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#5b5b5b">Faça seu pedido online — entrega e retirada</text>
  <text x="550" y="500" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#8a7a6a">rincao.vercel.app</text>
</svg>`);
}

(async () => {
  if (!fs.existsSync(src)) {
    console.error("Nao encontrei " + src);
    process.exit(1);
  }

  // icones quadrados
  for (const [arquivo, tamanho, fundoBranco] of [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["apple-touch-icon.png", 180, true],
  ]) {
    let img = sharp(src).resize(tamanho, tamanho, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: fundoBranco ? 1 : 0 },
    });
    if (fundoBranco) img = img.flatten({ background: "#ffffff" }); // iOS nao gosta de transparencia
    await img.png().toFile(path.join(publicDir, arquivo));
    console.log("gerado: public/" + arquivo);
  }

  // favicon.ico com 16/32/48
  const dims = [16, 32, 48];
  const pngs = [];
  for (const s of dims) {
    pngs.push(
      await sharp(src)
        .resize(s, s, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer()
    );
  }
  const ico = buildIco(pngs, dims);
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), ico);
  console.log("gerado: public/favicon.ico (" + Math.round(ico.length / 1024) + " KB)");

  // miniatura do link (WhatsApp) 1200x630
  const logoCard = await sharp(src)
    .resize(400, 400, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp(svgFundo())
    .composite([{ input: logoCard, top: 115, left: 80 }])
    .png({ quality: 90 })
    .toFile(path.join(publicDir, "cardapio-og.png"));
  const og = fs.statSync(path.join(publicDir, "cardapio-og.png"));
  console.log("gerado: public/cardapio-og.png (" + Math.round(og.size / 1024) + " KB)");
})();
