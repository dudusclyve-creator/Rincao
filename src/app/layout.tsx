import './globals.css';
import type { Metadata } from 'next';
import { CartProvider } from '@/lib/store';

export const metadata: Metadata = {
  metadataBase: new URL('https://rincao.vercel.app'),
  title: 'Rincão Lanches — Cardápio & Gestão',
  description: 'Cardápio digital, pedidos, PDV, caixa e gestão do Rincão Lanches.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = { themeColor: '#890000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
