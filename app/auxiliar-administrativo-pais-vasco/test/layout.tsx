const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Gobierno Vasco | 25 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Gobierno Vasco con los 13 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo pais-vasco',
    'tests auxiliar pais-vasco',
    'tests temas auxiliar pais-vasco',
    'test auxiliar administrativo gobierno pais-vasco',
    'tests oposiciones pais-vasco',
    'preguntas auxiliar administrativo pais-vasco',
    'examen auxiliar pais-vasco',
    '13 temas auxiliar pais-vasco',
    'C2 gobierno pais-vasco'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Gobierno Vasco - 25 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Gobierno Vasco. 13 temas oficiales en 1 bloque, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-pais-vasco/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Gobierno Vasco',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Gobierno Vasco | Vence',
    description: 'Tests de los 13 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-pais-vasco/test`,
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
