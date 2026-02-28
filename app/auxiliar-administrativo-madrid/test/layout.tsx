const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Comunidad de Madrid 2026 | 21 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo Comunidad de Madrid con los 21 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo madrid',
    'tests auxiliar madrid',
    'tests temas auxiliar madrid',
    'test auxiliar administrativo madrid 2026',
    'tests oposiciones comunidad de madrid',
    'preguntas auxiliar administrativo madrid',
    'examen auxiliar comunidad de madrid',
    '21 temas auxiliar madrid',
    'C2 comunidad de madrid'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Comunidad de Madrid - 21 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo Comunidad de Madrid. 21 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-madrid/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Comunidad de Madrid',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Comunidad de Madrid | Vence',
    description: 'Tests de los 21 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-madrid/test`,
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
