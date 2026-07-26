const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Agentes de Tributos - Agencia Tributaria Canaria 2026 | Vence',
  description: 'Temario completo del Agentes de Tributos - Agencia Tributaria Canaria actualizado 2026. 40 temas oficiales organizados en 2 partes.',
  keywords: [
    'temario agentes tributos canarias',
    'temario agentes tributos canarias 2026',
    'temario oficial administrativo ule',
    'oposiciones agentes tributos canarias',
    'temario agentes de tributos - agencia tributaria canaria',
    'temas agentes tributos canarias',
    'temario gratis agentes tributos canarias',
    'plazas agentes tributos canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Agentes de Tributos - Agencia Tributaria Canaria 2026 | Vence',
    description: 'Accede al temario completo del Agentes de Tributos - Agencia Tributaria Canaria. 40 temas oficiales organizados en 2 partes.',
    url: `${SITE_URL}/administrativo-agencia-tributaria-canaria/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Agentes de Tributos - Agencia Tributaria Canaria',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Agentes de Tributos - Agencia Tributaria Canaria | Vence',
    description: 'Temario completo y actualizado 2026. 40 temas oficiales del Agentes de Tributos - Agencia Tributaria Canaria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-agencia-tributaria-canaria/temario`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function TemarioLayout({ children }) {
  return children
}
