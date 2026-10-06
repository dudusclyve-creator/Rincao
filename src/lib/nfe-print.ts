import QRCode from 'qrcode';
import { BRL } from './utils';

const escapeHtml = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

export async function printDanfe(o: any) {
  try {
    const qr = o.nfeQrCode
      ? await QRCode.toDataURL(o.nfeQrCode, { width: 320, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      : '';
    const homolog = ((o.nfeQrCode || '').split('|')[2] || '') === '2';
    const rows = (o.items || [])
      .map((it: any) => {
        const addons = JSON.parse(it.addonsJson || '[]');
        const au = addons.reduce((s: number, a: any) => s + (a.price || 0) * (a.qty || 1), 0);
        const g = Math.round((it.qty * ((it.unitPrice || 0) + au)) * 100) / 100;
        const nome = [it.name, ...addons.map((a: any) => a.name)].join(' + ');
        return `<tr><td>${it.qty}x ${escapeHtml(nome)}</td><td class="r">${BRL(g)}</td></tr>`;
      })
      .join('');
    const feeRow = (o.deliveryFee || 0) > 0 ? `<tr><td>1x Taxa de entrega</td><td class="r">${BRL(o.deliveryFee)}</td></tr>` : '';
    const payMap: any = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Cartão de débito', credito: 'Cartão de crédito', cartao: 'Cartão' };
    const chaveFmt = (o.nfeKey || '').replace(/(\d{4})(?=\d)/g, '$1 ');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>DANFE NFC-e #${o.nfeNumber}</title><style>
      @page { size: 80mm auto; margin: 3mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; font-size: 12.5px; font-weight: bold; width: 74mm; margin: 0 auto; color: #000; }
      h1 { font-size: 15px; text-align: center; margin: 4px 0 0; }
      .c { text-align: center; } .r { text-align: right; }
      hr { border: none; border-top: 1.5px dashed #000; margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 1.5px 0; vertical-align: top; }
      .tot { font-size: 15px; font-weight: bold; }
      .qrcode { text-align: center; margin: 6px 0; }
      .qrcode img { width: 46mm; height: 46mm; }
      .chave { font-size: 10.5px; word-break: break-all; text-align: center; }
      .homolog { border: 2px solid #000; text-align: center; font-weight: bold; padding: 2px; margin: 4px 0; font-size: 11px; }
      .small { font-size: 10.5px; }
    </style></head><body>
      ${homolog ? '<div class="homolog">AMBIENTE DE HOMOLOGAÇÃO<br>SEM VALOR FISCAL</div>' : ''}
      <h1>DANFE NFC-e</h1>
      <div class="c small">Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>
      <hr>
      <div class="c"><b>43 - EMITENTE</b></div>
      <div><b>SANDRA REGINA DE MENEZES PIRES</b><br>RINCAO LANCHES<br>CNPJ: 42.462.389/0001-37<br>IE: 1060172256<br>AVENIDA DOM PEDRO II, 1694 - UMBU<br>SANTANA DO LIVRAMENTO/RS - CEP 97577-372<br>Fone: (55) 98437-5004</div>
      <hr>
      <div class="c"><b>#${o.nfeNumber} - DESTINATÁRIO / CONSUMIDOR</b></div>
      <div class="small">CONSUMIDOR NÃO IDENTIFICADO${o.customerName ? ` - ${escapeHtml(o.customerName)}` : ''}</div>
      <hr>
      <table>${rows}${feeRow}</table>
      <hr>
      <table>
        <tr><td>SUBTOTAL</td><td class="r">${BRL(o.subtotal)}</td></tr>
        ${(o.discount || 0) > 0 ? `<tr><td>DESCONTO</td><td class="r">-${BRL(o.discount)}</td></tr>` : ''}
        <tr class="tot"><td>VALOR TOTAL</td><td class="r">${BRL(o.total)}</td></tr>
      </table>
      <hr>
      <div><b>PAGAMENTO:</b> ${payMap[o.payment] || escapeHtml(o.payment)}${o.payment === 'dinheiro' && o.changeFor > 0 ? ` (troco para ${BRL(o.changeFor)})` : ''}</div>
      <hr>
      <div class="c"><b>CONSULTA DE AUTENTICIDADE</b></div>
      <div class="chave">${chaveFmt}</div>
      <div class="small c">Protocolo de autorização: ${o.nfeProtocol || '-'}<br>Consulte pelo QR Code ou em www.sefaz.rs.gov.br/nfce/consulta</div>
      <div class="qrcode">${qr ? `<img src="${qr}">` : ''}</div>
      <hr>
      <div class="small c">Rincao Lanches - Obrigado pela preferência!</div>
    </body></html>`;
    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) { alert('Permita pop-ups para imprimir o DANFE'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  } catch (e: any) {
    alert('Falha ao gerar o DANFE: ' + (e?.message || e));
  }
}
