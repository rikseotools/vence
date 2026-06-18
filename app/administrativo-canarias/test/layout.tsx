const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Cuerpo Administrativo Canarias 2026 | 30 temas Oficiales | Vence',
  description: 'Tests de Cuerpo Administrativo Canarias con los 30 temas oficiales del DOCM. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo canarias',
    'tests administrativo canarias',
    'tests temas administrativo canarias',
    'test administrativo canarias 2026',
    'tests oposiciones canarias',
    'preguntas administrativo canarias',
    'examen administrativo canarias',
    '30 temas administrativo canarias c1',
    'C1 gobierno de canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Cuerpo Administrativo Canarias - 30 temas Oficiales | Vence',
    description: 'Practica con tests de Cuerpo Administrativo Canarias. 30 temas oficiales en 6 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-canarias/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Cuerpo Administrativo Canarias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Cuerpo Administrativo Canarias | Vence',
    description: 'Tests de los 30 temas oficiales del DOCM. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-canarias/test`,
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
