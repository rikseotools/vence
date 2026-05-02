const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Celador SCS Canarias 2025 | 14 Temas Oficiales | Vence',
  description: 'Tests de Celador del Servicio Canario de Salud con los 14 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo E.',
  keywords: [
    'test celador scs',
    'tests celador canarias',
    'tests celador scs 2025',
    'tests oposiciones celador canarias',
    'preguntas celador scs',
    'examen celador canarias',
    '14 temas celador scs',
    'grupo E celador canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Celador SCS Canarias - 14 Temas Oficiales | Vence',
    description: 'Practica con tests de Celador del Servicio Canario de Salud. 14 temas oficiales, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/celador-scs-canarias/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Celador SCS Canarias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Celador SCS Canarias | Vence',
    description: 'Tests de los 14 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-scs-canarias/test`,
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
