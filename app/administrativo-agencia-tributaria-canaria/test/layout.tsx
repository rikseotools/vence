const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Agentes de Tributos - Agencia Tributaria Canaria 2026 | 40 Temas Oficiales | Vence',
  description: 'Tests de Agentes de Tributos - Agencia Tributaria Canaria con los 40 temas oficiales del BOC. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo C1.',
  keywords: [
    'test agentes tributos canarias',
    'tests administrativo ule',
    'tests temas administrativo ule',
    'test administrativo ule 2026',
    'tests oposiciones agentes tributos canarias',
    'preguntas administrativo ule',
    'examen agentes tributos canarias',
    '40 temas administrativo ule c1',
    'C1 agentes tributos canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Agentes de Tributos - Agencia Tributaria Canaria - 40 Temas Oficiales | Vence',
    description: 'Practica con tests de Agentes de Tributos - Agencia Tributaria Canaria. 40 temas oficiales en 2 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-agencia-tributaria-canaria/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Agentes de Tributos - Agencia Tributaria Canaria',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Agentes de Tributos - Agencia Tributaria Canaria | Vence',
    description: 'Tests de los 40 temas oficiales del BOC. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-agencia-tributaria-canaria/test`,
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

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
