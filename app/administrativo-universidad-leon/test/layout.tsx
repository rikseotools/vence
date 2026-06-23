const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Escala Administrativa Universidad de León 2026 | 25 Temas Oficiales | Vence',
  description: 'Tests de Escala Administrativa Universidad de León con los 25 temas oficiales del BOCYL. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo universidad de leon',
    'tests administrativo ule',
    'tests temas administrativo ule',
    'test administrativo ule 2026',
    'tests oposiciones universidad de leon',
    'preguntas administrativo ule',
    'examen administrativo universidad de leon',
    '25 temas administrativo ule c1',
    'C1 universidad de leon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Escala Administrativa Universidad de León - 25 Temas Oficiales | Vence',
    description: 'Practica con tests de Escala Administrativa Universidad de León. 25 temas oficiales en 5 grupos, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-universidad-leon/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Escala Administrativa Universidad de León',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Escala Administrativa Universidad de León | Vence',
    description: 'Tests de los 25 temas oficiales del BOCYL. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-universidad-leon/test`,
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
