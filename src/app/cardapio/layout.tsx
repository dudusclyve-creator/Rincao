import type { Metadata } from 'next';

// Texto que aparece quando alguem manda o link do cardapio no WhatsApp/Instagram.
// Fica num layout de servidor porque a pagina do cardapio roda no navegador
// e uma pagina 'use client' nao consegue exportar metadata.
const TITULO = 'Rincão Lanches - Cardápio Digital';
const DESCRICAO =
  "Cardápio do Rincão Lanches em Sant'Ana do Livramento: xis montado na hora, combos, tábuas, " +
  'porções e bebidas geladas. Peça online ou pelo WhatsApp. Delivery em cerca de 40 minutos.';
const SITE = 'https://rincao.vercel.app';

export const metadata: Metadata = {
  title: { absolute: TITULO },
  description: DESCRICAO,
  alternates: { canonical: '/cardapio' },
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    url: `${SITE}/cardapio`,
    siteName: 'Rincão Lanches',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: `${SITE}/cardapio-og.png`,
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
    images: [`${SITE}/cardapio-og.png`],
  },
};

// Dados estruturados (schema.org). Serve para o Google ligar este site a ficha
// do Rincão Lanches no Google Maps: mesmo nome, endereço, telefone e horário.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: 'Rincão Lanches',
  description: DESCRICAO,
  url: `${SITE}/cardapio`,
  image: `${SITE}/cardapio-og.png`,
  telephone: '+55 55 98437-5004',
  priceRange: 'R$ 20–40',
  servesCuisine: ['Lanches', 'Xis', 'Pizza'],
  menu: `${SITE}/cardapio`,
  hasMenu: `${SITE}/cardapio`,
  paymentAccepted: 'Pix, dinheiro, cartão de débito e cartão de crédito',
  currenciesAccepted: 'BRL',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Av. Dom Pedro II, 1694',
    addressLocality: "Sant'Ana do Livramento",
    addressRegion: 'RS',
    postalCode: '97577-372',
    addressCountry: 'BR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -30.8734029,
    longitude: -55.5057741,
  },
  areaServed: ["Sant'Ana do Livramento", 'Rivera'],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      opens: '19:00',
      closes: '00:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Friday', 'Saturday'],
      opens: '19:00',
      closes: '01:00',
    },
  ],
};

export default function CardapioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {children}
    </>
  );
}
