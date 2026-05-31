const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Generalitat de Catalunya | 25 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Generalitat de Catalunya con los 15 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo catalunya',
    'tests auxiliar catalunya',
    'tests temas auxiliar catalunya',
    'test auxiliar administrativo gobierno catalunya',
    'tests oposiciones catalunya',
    'preguntas auxiliar administrativo catalunya',
    'examen auxiliar catalunya',
    '15 temas auxiliar catalunya',
    'C2 gobierno catalunya'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Generalitat de Catalunya - 25 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Generalitat de Catalunya. 15 temas oficiales en 1 bloque, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-catalunya/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Generalitat de Catalunya',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Generalitat de Catalunya | Vence',
    description: 'Tests de los 15 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-catalunya/test`,
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
