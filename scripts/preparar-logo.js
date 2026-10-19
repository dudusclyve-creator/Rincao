// Prepara a logo nova (foto/mockup redondo) para uso no site:
//  - recorta o disco do fundo de madeira
//  - deixa os cantos transparentes (circulo)
//  - grava public/logo.png (1024x1024)
// Rode:  node scripts/preparar-logo.js <caminho-da-imagem>
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const raiz = path.join(__dirname, "..");
const origem = process.argv[2] || path.join("C:\\Users\\User\\Downloads", "logo.jfif");
const destino = path.join(raiz, "public", "logo.png");

// medida do disco na foto original (640x640), conferida com grade sobre a imagem
const recorte = { left: 27, top: 5, width: 586, height: 586 };
const LADO = 512;
const RAIO_DISCO = 289; // raio do aro, na escala original
const FOLGA = 3; // pixels (na escala final) para nao comer o aro

(async () => {
  if (!fs.existsSync(origem)) {
    console.error("Nao encontrei " + origem);
    process.exit(1);
  }

  const base = await sharp(origem)
    .extract(recorte)
    .resize(LADO, LADO, { fit: "fill" })
    .toBuffer();

  const r = (RAIO_DISCO / recorte.width) * LADO - FOLGA;
  const mascara = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}"><circle cx="${LADO / 2}" cy="${LADO / 2}" r="${r}" fill="#fff"/></svg>`
  );

  await sharp(base)
    .composite([{ input: mascara, blend: "dest-in" }])
    .png({ palette: true, quality: 92, compressionLevel: 9 })
    .toFile(destino);

  const st = fs.statSync(destino);
  console.log("gerado: public/logo.png (" + Math.round(st.size / 1024) + " KB, " + LADO + "x" + LADO + ")");
})();
