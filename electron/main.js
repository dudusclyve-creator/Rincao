// Processo principal do Electron: sobe o servidor Next.js (standalone) e abre o painel /admin
const { app, BrowserWindow, shell, dialog, screen } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");

let serverProcess = null;
let mainWindow = null;
let appEnv = {};

// ---------- utilidades ----------

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function standaloneDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, "server");
  return path.join(__dirname, "..", ".next", "standalone");
}

function iconPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, "icon.ico");
  return path.join(__dirname, "..", "build", "icon.ico");
}

function envFiles() {
  const files = [];
  if (app.isPackaged) {
    // 1) .env ao lado do .exe (tem prioridade, permite trocar sem recompilar)
    files.push(path.join(path.dirname(app.getPath("exe")), ".env"));
    // 2) .env empacotado nos resources
    files.push(path.join(process.resourcesPath, "server", ".env"));
  } else {
    files.push(path.join(__dirname, "..", ".env"));
  }
  return files;
}

function loadEnv() {
  let merged = {};
  for (const f of envFiles()) merged = { ...merged, ...parseEnvFile(f) };
  return merged;
}

function findFreePort(start) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", () => resolve(findFreePort(start + 1)));
    srv.listen(start, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForPort(port, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host: "127.0.0.1", port }, () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error("Servidor nao respondeu na porta " + port));
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

// ---------- impressao ----------

let appOrigin = "http://127.0.0.1:3000";
let logoConfigurado = false;

function isReceiptWindow(url) {
  return url === "about:blank" || url === "" || url === "about:srcdoc";
}

function isInternalUrl(url) {
  if (!url) return true;
  if (url.startsWith("about:") || url.startsWith("blob:") || url.startsWith("data:")) return true;
  if (url.startsWith(appOrigin)) return true;
  if (url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:")) return true;
  if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) return true;
  return false;
}

// A tela do cupom e criada pelo painel com window.open('', '_blank'). Ela fica
// escondida e serve apenas para o processo principal ler o texto e a logo.
//
// A impressao NAO passa pelo driver grafico: mandamos os comandos ESC/POS crus
// para a impressora (scripts/rawprint.ps1). Sem isso o driver monta uma folha
// fixa de 80 x 297 mm e a impressora puxa 30 cm -- ou metros -- por cupom.
function rawPrintScript() {
  if (app.isPackaged) return path.join(process.resourcesPath, "rawprint.ps1");
  return path.join(__dirname, "..", "scripts", "rawprint.ps1");
}

function impressoraAlvo() {
  return String(appEnv.PRINT_DEVICE || "").trim();
}

function arquivoTemp(nome) {
  return path.join(app.getPath("temp"), nome);
}

function colherCupom(wc) {
  const script = [
    "(function(){",
    "  try {",
    "    var textos = [];",
    "    var paginas = document.querySelectorAll('pre.receipt');",
    "    for (var i = 0; i < paginas.length; i++) textos.push(paginas[i].textContent || '');",
    "    if (!textos.length && document.body) textos.push(document.body.innerText || '');",
    "    var img = document.getElementById('logo');",
    "    var logo = (img && img.getAttribute('src')) || '';",
    "    return { textos: textos, logo: logo };",
    "  } catch (e) { return { textos: [], logo: '', erro: String(e) }; }",
    "})()",
  ].join("\n");
  return wc.executeJavaScript(script);
}

// baixa a logo (ex.: /logo.png) para um arquivo, que o script de impressao
// converte em bitmap ESC/POS. Se falhar, o cupom sai sem logo.
async function baixarLogo(url) {
  try {
    const alvo = String(url || "").trim();
    if (!alvo || alvo === "about:blank") return "";
    const destino = arquivoTemp("rincao-logo.png");

    if (alvo.startsWith("data:")) {
      const m = /^data:([^;,]*);base64,(.*)$/s.exec(alvo);
      if (!m) return "";
      fs.writeFileSync(destino, Buffer.from(m[2], "base64"));
      return destino;
    }

    const completo = alvo.startsWith("/") ? appOrigin + alvo : alvo;
    const res = await fetch(completo);
    if (!res.ok) return "";
    const tipo = String(res.headers.get("content-type") || "");
    if (tipo && !/png|jpe?g|bmp|gif/i.test(tipo)) return "";
    fs.writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
    return destino;
  } catch (e) {
    return "";
  }
}

// manda o texto (uma pagina por form feed) para o script ESC/POS
function enviarParaImpressora(texto, logo) {
  return new Promise((resolve) => {
    const txt = arquivoTemp("rincao-cupom.txt");
    fs.writeFileSync(txt, texto, "utf8");

    const args = [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      rawPrintScript(),
      "-TextFile",
      txt,
      "-Fonte",
      String(appEnv.PRINT_FONTE || "2x1").trim() || "2x1",
    ];
    const impressora = impressoraAlvo();
    if (impressora) args.push("-Printer", impressora);
    if (logo) args.push("-LogoFile", logo);
    const largura = String(appEnv.PRINT_LARGURA_DOTS || "").trim();
    if (largura) args.push("-LarguraDots", largura);
    const espaco = String(appEnv.PRINT_ESPACO || "").trim();
    if (espaco) args.push("-Espaco", espaco);

    const ps = spawn("powershell", args, { windowsHide: true });
    let saida = "";
    ps.stdout.on("data", (d) => (saida += d));
    ps.stderr.on("data", (d) => (saida += d));
    ps.on("error", (e) => resolve({ ok: false, saida: String(e && e.message) }));
    ps.on("close", (codigo) => resolve({ ok: codigo === 0, saida: saida.trim() }));
  });
}

// le a configuracao do restaurante uma vez para saber se existe logo no cupom
async function lerConfigImpressao() {
  try {
    const res = await fetch(appOrigin + "/api/settings");
    if (!res.ok) return;
    const cfg = await res.json();
    logoConfigurado = !!(cfg && typeof cfg.logoUrl === "string" && cfg.logoUrl.trim());
  } catch (e) {
    logoConfigurado = false;
  }
}

function gerenciarJanelaDeRecibo(child) {
  const wc = child.webContents;
  const inicio = Date.now();
  let conteudoEm = 0;
  let assumido = false;

  const tick = setInterval(async () => {
    if (assumido) return;
    if (wc.isDestroyed()) {
      clearInterval(tick);
      return;
    }

    let estado = { tam: 0, logo: false, recibo: false };
    try {
      // - troca o window.print() por nada: quem imprime e o processo principal
      //   (se o painel chamar print(), o driver puxaria a folha de 30 cm)
      // - ve se o conteudo chegou, se a logo ja chegou e se e um cupom
      //   (cupom = tem <pre class="receipt">; DANFE/documento nao tem)
      estado = await wc.executeJavaScript(
        "(function(){ try { window.print = function(){ window.__rincaoPediu = true; }; } catch(e){} var img = document.getElementById('logo'); var rec = document.querySelectorAll('pre.receipt'); return { tam: document.body ? document.body.innerHTML.length : 0, logo: !!(img && img.getAttribute('src')), recibo: rec.length > 0 }; })()"
      );
    } catch (e) {
      estado = { tam: 0, logo: false, recibo: false };
    }

    const tamanho = estado && estado.tam ? estado.tam : 0;
    const chegouLogo = !!(estado && estado.logo);
    const ehRecibo = !!(estado && estado.recibo);

    if (assumido) return; // outra volta ja assumiu a impressao
    if (tamanho > 0 && !conteudoEm) conteudoEm = Date.now();

    if (conteudoEm) {
      const espera = Date.now() - conteudoEm;

      if (ehRecibo) {
        // cupom: sai direto por ESC/POS (papel do tamanho certo, com corte).
        // espera a logo do restaurante; se ela demorar (ou nao existir), imprime assim mesmo.
        const pronto = espera > 900 && (chegouLogo || !logoConfigurado);
        if (pronto || espera > 2500) {
          assumido = true;
          clearInterval(tick);
          imprimirEfechar(wc);
          return;
        }
      } else if (espera > 1500) {
        // documento de pagina inteira (DANFE): usa o caminho normal do Windows
        assumido = true;
        clearInterval(tick);
        imprimirDocumento(wc);
        return;
      }
    }

    if (Date.now() - inicio > 20000) clearInterval(tick);
  }, 80);
}

// paginas inteiras (DANFE) continuam pelo driver do Windows -- o ESC/POS e
// para cupom de 80 mm, nao para documento de tamanho A4
function imprimirDocumento(wc) {
  const win = BrowserWindow.fromWebContents(wc);
  const fechar = () => {
    setTimeout(() => {
      try {
        if (win && !win.isDestroyed()) win.close();
      } catch (e) {}
    }, 800);
  };

  const opts = { silent: true, printBackground: true };
  const destino = impressoraAlvo();
  if (destino) opts.deviceName = destino;

  console.log("[print] documento de pagina inteira -> " + (destino || "(impressora padrao)"));
  try {
    wc.print(opts, (ok, motivo) => {
      if (!ok) console.error("[print] falhou: " + motivo);
      fechar();
    });
  } catch (e) {
    console.error("[print] erro: " + (e && e.message));
    fechar();
  }
}

async function imprimirEfechar(wc) {
  const win = BrowserWindow.fromWebContents(wc);

  const fechar = () => {
    setTimeout(() => {
      try {
        if (win && !win.isDestroyed()) win.close();
      } catch (e) {}
    }, 300);
  };

  if (wc.isDestroyed()) return;

  let cupom = null;
  try {
    cupom = await colherCupom(wc);
  } catch (e) {
    cupom = null;
  }

  const textos = ((cupom && cupom.textos) || []).filter((t) => String(t || "").trim().length > 0);
  if (!textos.length) {
    console.error("[print] nao achei texto no cupom");
    fechar();
    return;
  }

  const logo = await baixarLogo(cupom && cupom.logo);
  const destino = impressoraAlvo() || "(impressora padrao do Windows)";
  console.log(
    "[print] " + textos.length + " pagina(s), logo " + (logo ? "sim" : "nao") + " -> " + destino
  );

  const r = await enviarParaImpressora(textos.join("\f"), logo);
  if (r.ok) console.log("[print] ok: " + r.saida);
  else console.error("[print] falhou: " + r.saida);

  fechar();
}

function setupWindowOpenHandler(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    // recibo / DANFE: abre escondido e imprime sozinho
    if (isReceiptWindow(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          show: false,
          skipTaskbar: true,
          width: 420,
          height: 700,
          autoHideMenuBar: true,
          backgroundColor: "#ffffff",
          webPreferences: { backgroundThrottling: false },
        },
      };
    }
    // resto do proprio painel (XML, PDF da nota) abre numa janela normal
    if (isInternalUrl(url)) {
      return { action: "allow" };
    }
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("did-create-window", (child, details) => {
    if (details && isReceiptWindow(details.url)) gerenciarJanelaDeRecibo(child);
  });
}

// ---------- servidor Next ----------

async function startServer() {
  const dir = standaloneDir();
  const serverJs = path.join(dir, "server.js");
  if (!fs.existsSync(serverJs)) {
    throw new Error("Nao encontrei o servidor em:\n" + serverJs + "\nRode o build antes (npm run dist).");
  }

  const port = await findFreePort(3000);
  const extraEnv = loadEnv();
  appEnv = extraEnv;

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: dir,
    env: {
      ...process.env,
      ...extraEnv,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write("[server] " + d));
  serverProcess.stderr.on("data", (d) => process.stderr.write("[server] " + d));
  serverProcess.on("exit", (code) => {
    if (code !== 0 && !app.isQuitting) {
      dialog.showErrorBox("Servidor encerrou", "O servidor interno parou (codigo " + code + ").");
    }
  });

  await waitForPort(port);
  return port;
}

// ---------- janela ----------

function createWindow(port) {
  const area = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: area.width,
    height: area.height,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#111114",
    title: "Rincao Lanches - Painel",
    icon: iconPath(),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // abre ocupando a tela toda (mas ainda da pra restaurar/minimizar)
  mainWindow.maximize();

  setupWindowOpenHandler(mainWindow.webContents);

  mainWindow.loadURL("http://127.0.0.1:" + port + "/admin");

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle("Rincao Lanches - Painel");
  });

  mainWindow.on("closed", () => (mainWindow = null));
}

// ---------- ciclo de vida ----------

app.whenReady().then(async () => {
  try {
    const port = await startServer();
    appOrigin = "http://127.0.0.1:" + port;
    await lerConfigImpressao();
    createWindow(port);
  } catch (err) {
    dialog.showErrorBox("Falha ao iniciar", String(err && err.message ? err.message : err));
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  app.isQuitting = true;
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch (_) {}
  }
});
