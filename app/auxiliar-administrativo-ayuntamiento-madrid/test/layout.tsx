const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Madrid 2026 | 22 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Ayuntamiento de Madrid con los 22 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo ayuntamiento madrid',
    'tests auxiliar ayuntamiento madrid',
    'tests temas auxiliar ayuntamiento madrid',
    'test auxiliar administrativo madrid 2026',
    'tests oposiciones ayuntamiento madrid',
    'preguntas auxiliar administrativo ayuntamiento madrid',
    'examen auxiliar ayuntamiento madrid',
    '22 temas auxiliar ayuntamiento madrid',
    'C2 ayuntamiento madrid'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Madrid - 22 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Ayuntamiento de Madrid. 22 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-madrid/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Ayuntamiento de Madrid',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Madrid | Vence',
    description: 'Tests de los 22 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-madrid/test`,
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
