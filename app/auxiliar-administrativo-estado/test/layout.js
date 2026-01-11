const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Estado 2026 | Todos los Temas | Vence',
  description: 'Tests de Auxiliar Administrativo del Estado con todos los 16 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. ¡Gratis!',
  keywords: [
    'test auxiliar administrativo estado',
    'tests auxiliar administrativo',
    'tests temas auxiliar administrativo',
    'test tema 1 auxiliar administrativo',
    'test constitución española',
    'test auxiliar administrativo 2026',
    'tests oposiciones auxiliar administrativo',
    'preguntas auxiliar administrativo estado',
    'examen auxiliar administrativo',
    'tests gratis auxiliar administrativo'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Estado - 16 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Estado. 16 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-estado/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Estado',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Estado | Vence',
    description: 'Tests de todos los 16 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-estado/test`,
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

export default function TestLayout({ children }) {
  return children
}