const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad de Almería 2026 | 12 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Universidad de Almería con los 17 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo universidad de almeria',
    'tests auxiliar universidad de almeria',
    'tests temas auxiliar universidad de almeria',
    'test auxiliar administrativo almeria 2026',
    'tests oposiciones universidad de almeria',
    'preguntas auxiliar administrativo universidad de almeria',
    'examen auxiliar universidad de almeria',
    '17 temas auxiliar universidad de almeria',
    'C2 universidad de almeria'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad de Almería - 12 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Universidad de Almería. 17 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-universidad-almeria/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Universidad de Almería',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Universidad de Almería | Vence',
    description: 'Tests de los 17 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-universidad-almeria/test`,
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
