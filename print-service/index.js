// Bridge local de impressão térmica (USB/Rede).
// Rode: node print-service/index.js
// Recebe POST /print { text, ip?, porta? } e envia ESC/POS via TCP (porta 9100)
// Para USB, instale `escpos` + `escpos-usb` e adapte a função abaixo.
const http = require('http');
const net = require('net');
const PORT = process.env.BRIDGE_PORT || 8787;

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { text, ip, porta } = JSON.parse(body);
        const ESC = '\x1b', GS = '\x1d';
        const payload = ESC + '@' + text + '\n\n\n' + GS + 'V\x00'; // init + cut
        if (ip) {
          const sock = net.connect(porta || 9100, ip, () => { sock.write(payload, () => sock.end()); });
          sock.on('error', (e) => console.error('printer err', e.message));
        } else {
          console.log('=== CUPOM (sem impressora IP: configure ip) ===\n' + text);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) { res.writeHead(400); res.end('erro'); }
    });
  } else { res.writeHead(404); res.end(); }
}).listen(PORT, () => console.log(`Print bridge on :${PORT}`));
