const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo del Estado 2026 | 45 Temas Oficiales | Vence',
  description: 'Tests de Administrativo del Estado con los 45 temas oficiales del BOE. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo del estado',
    'tests administrativo estado',
    'tests temas administrativo estado',
    'test administrativo del estado 2026',
    'tests oposiciones administrativo',
    'preguntas administrativo del estado',
    'examen administrativo del estado',
    'tests gratis administrativo',
    '45 temas administrativo',
    'C1 administrativo estado'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo del Estado - 45 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo del Estado. 45 temas oficiales en 6 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-estado/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativo del Estado',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo del Estado | Vence',
    description: 'Tests de los 45 temas oficiales del BOE. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-estado/test`,
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
