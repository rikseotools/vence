const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad de Cádiz 2026 | 12 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Universidad de Cádiz con los 27 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo universidad de cádiz',
    'tests auxiliar universidad de cádiz',
    'tests temas auxiliar universidad de cádiz',
    'test auxiliar administrativo cadiz 2026',
    'tests oposiciones universidad de cádiz',
    'preguntas auxiliar administrativo universidad de cádiz',
    'examen auxiliar universidad de cádiz',
    '27 temas auxiliar universidad de cádiz',
    'C2 universidad de cádiz'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad de Cádiz - 12 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Universidad de Cádiz. 27 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-universidad-cadiz/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Universidad de Cádiz',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Universidad de Cádiz | Vence',
    description: 'Tests de los 27 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-universidad-cadiz/test`,
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
