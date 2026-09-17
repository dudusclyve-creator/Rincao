import './globals.css';
import type { Metadata } from 'next';
import { CartProvider } from '@/lib/store';

export const metadata: Metadata = {
  title: 'Rincão Lanches — Cardápio & Gestão',
  description: 'Cardápio digital, pedidos, PDV, caixa e gestão do Rincão Lanches.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};

export const viewport = { themeColor: '#890000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
