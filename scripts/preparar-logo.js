// Prepara a logo nova (foto/mockup redondo) para uso no site:
//  - recorta o disco do fundo de madeira, certinho na borda do aro
//  - deixa os cantos transparentes (circulo)
//  - grava public/logo.png (512x512)
// Rode:  node scripts/preparar-logo.js <caminho-da-imagem>
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const raiz = path.join(__dirname, "..");
const origem = process.argv[2] || path.join("C:\\Users\\User\\Downloads", "logo.jfif");
const destino = path.join(raiz, "public", "logo.png");

// disco medido na foto original (640x640) por ajuste de circulo sobre o aro:
// centro (304,3 ; 297,0), raio 280,1 -> quadrado de 560 a partir de (24, 17).
// O recorte tem exatamente o diametro do aro, entao a logo toca as bordas do
// quadrado: no site ela encaixa justinho dentro da borda redonda do container.
const recorte = { left: 24, top: 17, width: 560, height: 560 };
const LADO = 512;
const RAIO_DISCO = 280; // raio do aro, na escala original
const FOLGA = 0.5; // pixels (na escala final) para nao comer o aro

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
