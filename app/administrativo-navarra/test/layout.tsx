const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo Gobierno de Navarra | 27 Temas Oficiales | Vence',
  description: 'Tests de Administrativo del Gobierno de Navarra con los 27 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo navarra',
    'tests administrativo navarra',
    'tests temas administrativo navarra',
    'test administrativo gobierno navarra',
    'tests oposiciones navarra',
    'preguntas administrativo navarra',
    'examen administrativo navarra',
    '27 temas administrativo navarra',
    'C1 gobierno navarra'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo Gobierno de Navarra - 27 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo del Gobierno de Navarra. 27 temas oficiales en 3 partes, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-navarra/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativo Gobierno de Navarra',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo Gobierno de Navarra | Vence',
    description: 'Tests de los 27 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-navarra/test`,
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
