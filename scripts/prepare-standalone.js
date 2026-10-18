// Prepara a pasta .next/standalone para ser empacotada no aplicativo.
// O Next.js em modo "standalone" nao copia automaticamente:
//   - .next/static  (assets do cliente)
//   - public        (arquivos estaticos)
//   - engines do Prisma
// Este script faz essas copias.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log("(pulado, nao existe): " + src);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log("copiado: " + path.relative(root, src) + "  ->  " + path.relative(root, dest));
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.log("(pulado, nao existe): " + src);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("copiado: " + path.relative(root, src) + "  ->  " + path.relative(root, dest));
}

if (!fs.existsSync(standalone)) {
  console.error("ERRO: " + standalone + " nao existe. Rode 'npm run build' primeiro.");
  process.exit(1);
}

// assets do cliente e arquivos publicos
copyDir(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
copyDir(path.join(root, "public"), path.join(standalone, "public"));

// Prisma: client gerado + engines nativas
copyDir(path.join(root, "node_modules", ".prisma"), path.join(standalone, "node_modules", ".prisma"));
copyDir(
  path.join(root, "node_modules", "@prisma", "client"),
  path.join(standalone, "node_modules", "@prisma", "client")
);

// credenciais/parametros do app empacotados
copyFile(path.join(root, ".env"), path.join(standalone, ".env"));

console.log("\nOK: standalone pronto em " + standalone);
