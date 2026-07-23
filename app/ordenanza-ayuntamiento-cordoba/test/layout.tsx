const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Ordenanza del Ayuntamiento de Córdoba 2026 | 20 Temas Oficiales | Vence',
  description: 'Tests de Ordenanza del Ayuntamiento de Córdoba con los 20 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo ayuntamiento cordoba',
    'tests auxiliar ayuntamiento cordoba',
    'tests temas auxiliar ayuntamiento cordoba',
    'test auxiliar administrativo cordoba 2026',
    'tests oposiciones ayuntamiento cordoba',
    'preguntas auxiliar administrativo ayuntamiento cordoba',
    'examen auxiliar ayuntamiento cordoba',
    '20 temas auxiliar ayuntamiento cordoba',
    'C2 ayuntamiento cordoba'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Ordenanza del Ayuntamiento de Córdoba - 20 Temas Oficiales | Vence',
    description: 'Practica con tests de Ordenanza del Ayuntamiento de Córdoba. 20 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/ordenanza-ayuntamiento-cordoba/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Ordenanza del Ayuntamiento de Córdoba',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Ordenanza del Ayuntamiento de Córdoba | Vence',
    description: 'Tests de los 20 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/ordenanza-ayuntamiento-cordoba/test`,
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
