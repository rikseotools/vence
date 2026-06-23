const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo de la Comunidad de Madrid 2026 | 47 Temas Oficiales | Vence',
  description: 'Tests de Administrativo de la Comunidad de Madrid con los 47 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo comunidad de madrid',
    'tests administrativo comunidad de madrid',
    'tests temas administrativo comunidad de madrid',
    'test administrativo comunidad de madrid 2026',
    'tests oposiciones comunidad de madrid',
    'preguntas administrativo comunidad de madrid',
    'examen administrativo comunidad de madrid',
    '47 temas administrativo comunidad de madrid',
    'C1 comunidad de madrid'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo de la Comunidad de Madrid - 47 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo de la Comunidad de Madrid. 47 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-madrid/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativo de la Comunidad de Madrid',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo de la Comunidad de Madrid | Vence',
    description: 'Tests de los 47 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-madrid/test`,
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
