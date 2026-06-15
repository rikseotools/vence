const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad de Alcalá 2026 | 12 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Universidad de Alcalá con los 18 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo universidad de alcalá',
    'tests auxiliar universidad de alcalá',
    'tests temas auxiliar universidad de alcalá',
    'test auxiliar administrativo alcala 2026',
    'tests oposiciones universidad de alcalá',
    'preguntas auxiliar administrativo universidad de alcalá',
    'examen auxiliar universidad de alcalá',
    '18 temas auxiliar universidad de alcalá',
    'C2 universidad de alcalá'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad de Alcalá - 12 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Universidad de Alcalá. 18 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-universidad-alcala/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Universidad de Alcalá',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Universidad de Alcalá | Vence',
    description: 'Tests de los 18 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-universidad-alcala/test`,
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
