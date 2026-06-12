const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Celador SERGAS Galicia 2025 | 17 Temas Oficiales | Vence',
  description: 'Tests de Celador del Servicio Gallego de Salud con los 17 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo E.',
  keywords: [
    'test celador scs',
    'tests celador canarias',
    'tests celador scs 2025',
    'tests oposiciones celador canarias',
    'preguntas celador scs',
    'examen celador canarias',
    '17 temas celador scs',
    'grupo E celador canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Celador SERGAS Galicia - 17 Temas Oficiales | Vence',
    description: 'Practica con tests de Celador del Servicio Gallego de Salud. 17 temas oficiales, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/celador-galicia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Celador SERGAS Galicia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Celador SERGAS Galicia | Vence',
    description: 'Tests de los 17 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-galicia/test`,
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
