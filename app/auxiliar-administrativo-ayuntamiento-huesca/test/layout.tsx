const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo del Ayuntamiento de Huesca 2026 | 12 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Ayuntamiento de Huesca con los 28 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo ayuntamiento de huesca',
    'tests auxiliar ayuntamiento de huesca',
    'tests temas auxiliar ayuntamiento de huesca',
    'test auxiliar administrativo huesca 2026',
    'tests oposiciones ayuntamiento de huesca',
    'preguntas auxiliar administrativo ayuntamiento de huesca',
    'examen auxiliar ayuntamiento de huesca',
    '28 temas auxiliar ayuntamiento de huesca',
    'C2 ayuntamiento de huesca'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo del Ayuntamiento de Huesca - 12 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Ayuntamiento de Huesca. 28 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-huesca/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo del Ayuntamiento de Huesca',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo del Ayuntamiento de Huesca | Vence',
    description: 'Tests de los 28 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-huesca/test`,
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
