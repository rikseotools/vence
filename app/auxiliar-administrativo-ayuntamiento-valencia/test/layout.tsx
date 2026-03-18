const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Ayuntamiento de Valencia 2026 | 21 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Ayuntamiento de Valencia con los 21 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo ayuntamiento valencia',
    'tests auxiliar ayuntamiento valencia',
    'tests temas auxiliar ayuntamiento valencia',
    'test auxiliar administrativo valencia 2026',
    'tests oposiciones ayuntamiento valencia',
    'preguntas auxiliar administrativo ayuntamiento valencia',
    'examen auxiliar ayuntamiento valencia',
    '21 temas auxiliar ayuntamiento valencia',
    'C2 ayuntamiento valencia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Valencia - 21 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Ayuntamiento de Valencia. 21 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-valencia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Ayuntamiento de Valencia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Valencia | Vence',
    description: 'Tests de los 21 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-valencia/test`,
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
