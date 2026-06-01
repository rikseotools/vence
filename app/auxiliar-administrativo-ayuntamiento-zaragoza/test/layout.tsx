const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Ayuntamiento de Zaragoza 2026 | 20 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Ayuntamiento de Zaragoza con los 25 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo ayuntamiento zaragoza',
    'tests auxiliar ayuntamiento zaragoza',
    'tests temas auxiliar ayuntamiento zaragoza',
    'test auxiliar administrativo zaragoza 2026',
    'tests oposiciones ayuntamiento zaragoza',
    'preguntas auxiliar administrativo ayuntamiento zaragoza',
    'examen auxiliar ayuntamiento zaragoza',
    '25 temas auxiliar ayuntamiento zaragoza',
    'C2 ayuntamiento zaragoza'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Zaragoza - 20 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Ayuntamiento de Zaragoza. 25 temas oficiales en 3 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-zaragoza/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Ayuntamiento de Zaragoza',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Zaragoza | Vence',
    description: 'Tests de los 25 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-zaragoza/test`,
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
