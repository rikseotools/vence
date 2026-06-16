const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Zamora 2026 | 20 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Diputación Provincial de Zamora con los 20 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo diputacion zamora',
    'tests auxiliar diputacion zamora',
    'tests temas auxiliar diputacion zamora',
    'test auxiliar administrativo zamora 2026',
    'tests oposiciones diputacion zamora',
    'preguntas auxiliar administrativo diputacion zamora',
    'examen auxiliar diputacion zamora',
    '20 temas auxiliar diputacion zamora',
    'C2 diputacion zamora'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Zamora - 20 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Diputación Provincial de Zamora. 20 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-diputacion-zamora/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Diputación Provincial de Zamora',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Zamora | Vence',
    description: 'Tests de los 20 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-diputacion-zamora/test`,
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
