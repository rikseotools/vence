const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación de Girona 2026 | 12 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Diputación de Girona con los 20 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo diputación de girona',
    'tests auxiliar diputación de girona',
    'tests temas auxiliar diputación de girona',
    'test auxiliar administrativo girona 2026',
    'tests oposiciones diputación de girona',
    'preguntas auxiliar administrativo diputación de girona',
    'examen auxiliar diputación de girona',
    '20 temas auxiliar diputación de girona',
    'C2 diputación de girona'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación de Girona - 12 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Diputación de Girona. 20 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-diputacion-girona/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Diputación de Girona',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Diputación de Girona | Vence',
    description: 'Tests de los 20 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-diputacion-girona/test`,
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
