import type { Metadata } from 'next';

// Texto que aparece quando alguem manda o link do cardapio no WhatsApp/Instagram.
// Fica num layout de servidor porque a pagina do cardapio roda no navegador
// e uma pagina 'use client' nao consegue exportar metadata.
const TITULO = 'Rincão Lanches - Cardápio Digital';
const DESCRICAO = 'Cardápio digital do Rincão Lanches — confira os lanches, porções e bebidas e faça seu pedido online.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    url: 'https://rincao.vercel.app/cardapio',
    siteName: 'Rincão Lanches',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://rincao.vercel.app/cardapio-og.png',
        width: 1200,
        height: 630,
        alt: 'Rincão Lanches - Cardápio Digital',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRICAO,
    images: ['https://rincao.vercel.app/cardapio-og.png'],
  },
};

export default function CardapioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
