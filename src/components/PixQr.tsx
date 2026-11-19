'use client';
import { QRCodeSVG } from 'qrcode.react';

// QR do PIX: usa a imagem que o Mercado Pago devolve (base64). Se ela nao vier,
// gera o QR a partir do copia-e-cola no proprio navegador.
export function PixQr({ value, image, size = 190 }: { value?: string; image?: string | null; size?: number }) {
  const src = String(image || '').trim();
  if (src.length > 100) {
    const url = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
    return <img src={url} alt="QR Code PIX" width={size} height={size} className="rounded-lg" style={{ imageRendering: 'pixelated' }} />;
  }
  if (!value) return null;
  return <QRCodeSVG value={value} size={size} level="M" includeMargin />;
}
