const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Celador SERMAS Madrid 2025 | 17 Temas Oficiales | Vence',
  description: 'Tests de Celador del SERMAS con los 16 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo E.',
  keywords: [
    'test celador sermas madrid',
    'tests celador madrid',
    'tests celador sermas madrid 2025',
    'tests oposiciones celador madrid',
    'preguntas celador sermas madrid',
    'examen celador madrid',
    '16 temas celador sermas madrid',
    'grupo E celador madrid'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Celador SERMAS Madrid - 17 Temas Oficiales | Vence',
    description: 'Practica con tests de Celador del SERMAS. 16 temas oficiales, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/celador-sermas-madrid/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Celador SERMAS Madrid',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Celador SERMAS Madrid | Vence',
    description: 'Tests de los 16 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-sermas-madrid/test`,
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
