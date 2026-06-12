const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo Gobierno Vasco | 25 Temas Oficiales | Vence',
  description: 'Tests de Administrativo del Gobierno Vasco con los 34 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo pais-vasco',
    'tests administrativo pais-vasco',
    'tests temas administrativo pais-vasco',
    'test administrativo gobierno pais-vasco',
    'tests oposiciones pais-vasco',
    'preguntas administrativo pais-vasco',
    'examen administrativo pais-vasco',
    '34 temas administrativo pais-vasco',
    'C1 gobierno pais-vasco'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo Gobierno Vasco - 25 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo del Gobierno Vasco. 34 temas oficiales en 1 bloque, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-pais-vasco/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativo Gobierno Vasco',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo Gobierno Vasco | Vence',
    description: 'Tests de los 34 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-pais-vasco/test`,
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
