import './globals.css';
import type { Metadata } from 'next';
import { CartProvider } from '@/lib/store';

const TITULO = "Rincão Lanches — Xis e delivery em Sant'Ana do Livramento";
const DESCRICAO =
  "Xis montado na hora, combos, tábuas e porções no bairro Umbu, em Sant'Ana do Livramento. " +
  'Delivery em cerca de 40 minutos e retirada no balcão.';

export const metadata: Metadata = {
  metadataBase: new URL('https://rincao.vercel.app'),
  title: {
    default: TITULO,
    template: '%s · Rincão Lanches',
  },
  description: DESCRICAO,
  applicationName: 'Rincão Lanches',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Rincão Lanches',
    url: 'https://rincao.vercel.app',
    title: TITULO,
    description: DESCRICAO,
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
