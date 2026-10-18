// Gera build/icon.ico a partir de public/logo.png.
// Escreve o container .ico manualmente (entradas em PNG, suportado pelo Windows Vista+),
// evitando depender de bibliotecas ESM-only.
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const src = path.join(root, "public", "logo.png");
const outDir = path.join(root, "build");
const out = path.join(outDir, "icon.ico");
const sizes = [16, 24, 32, 48, 64, 128, 256];

// ICONDIR + N x ICONDIRENTRY, seguido dos PNGs
function buildIco(pngs, dims) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;
  for (let i = 0; i < count; i++) {
    const size = dims[i];
    const data = pngs[i];
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 significa 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngs]);
}

(async () => {
  if (!fs.existsSync(src)) {
    console.error("Nao encontrei " + src);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rincao-ico-"));

  const pngs = [];
  const dims = [];
  for (const s of sizes) {
    const file = path.join(tmp, s + ".png");
    await sharp(src)
      .resize(s, s, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(file);
    pngs.push(fs.readFileSync(file));
    dims.push(s);
  }

  const ico = buildIco(pngs, dims);
  fs.writeFileSync(out, ico);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("icone gerado: " + out + " (" + Math.round(ico.length / 1024) + " KB, " + sizes.length + " tamanhos)");
})();
