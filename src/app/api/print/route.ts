import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Arquitetura de impressão real:
// 1) Navegador: o painel usa window.print() com layout 58/80mm (CSS @media print).
// 2) Bridge local (print-service/): POST aqui com { escpos, ip, porta } e o serviço
//    envia bytes ESC/POS via USB (node-usb/escpos) ou rede (socket TCP 9100).
// 3) QZ Tray / RawBT: o payload `text` pode ser enviado por esses apps.
export async function POST(req: Request) {
  const b = await req.json();
  console.log('[PRINT]', b.printer || 'Padrao', (b.text || '').slice(0, 200));
  // TODO: integrar com serviço local via TCP quando configurado (PRINT_BRIDGE_URL)
  const bridge = process.env.PRINT_BRIDGE_URL;
  if (bridge) {
    try {
      await fetch(`${bridge}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
      return NextResponse.json({ ok: true, via: 'bridge' });
    } catch (e) { return NextResponse.json({ ok: false, error: 'bridge off-line, use window.print' }); }
  }
  return NextResponse.json({ ok: true, via: 'browser', hint: 'Use window.print() com CSS 58/80mm ou instale print-service/' });
}
