const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Generalitat Valenciana | 24 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo Generalitat Valenciana con los 24 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo valencia',
    'tests auxiliar valencia',
    'tests temas auxiliar valencia',
    'test auxiliar administrativo generalitat valenciana',
    'tests oposiciones valencia',
    'preguntas auxiliar administrativo valencia',
    'examen auxiliar valencia',
    '24 temas auxiliar valencia',
    'C2 generalitat valenciana'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Generalitat Valenciana - 24 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo Generalitat Valenciana. 24 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-valencia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Generalitat Valenciana',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Generalitat Valenciana | Vence',
    description: 'Tests de los 24 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-valencia/test`,
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
