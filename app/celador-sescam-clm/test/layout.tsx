const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Celador SESCAM Castilla-La Mancha 2025 | 17 Temas Oficiales | Vence',
  description: 'Tests de Celador del SESCAM con los 15 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo E.',
  keywords: [
    'test celador sescam clm',
    'tests celador castilla-la mancha',
    'tests celador sescam clm 2025',
    'tests oposiciones celador castilla-la mancha',
    'preguntas celador sescam clm',
    'examen celador castilla-la mancha',
    '15 temas celador sescam clm',
    'grupo E celador castilla-la mancha'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Celador SESCAM Castilla-La Mancha - 17 Temas Oficiales | Vence',
    description: 'Practica con tests de Celador del SESCAM. 15 temas oficiales, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/celador-sescam-clm/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Celador SESCAM Castilla-La Mancha',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Celador SESCAM Castilla-La Mancha | Vence',
    description: 'Tests de los 15 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-sescam-clm/test`,
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
