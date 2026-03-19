const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Junta de Castilla-La Mancha | 24 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo Junta de Castilla-La Mancha con los 24 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo clm',
    'tests auxiliar clm',
    'tests temas auxiliar clm',
    'test auxiliar administrativo castilla la mancha',
    'tests oposiciones jccm',
    'preguntas auxiliar administrativo clm',
    'examen auxiliar jccm',
    '24 temas auxiliar clm',
    'C2 junta castilla la mancha'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Junta de Castilla-La Mancha - 24 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo Junta de Castilla-La Mancha. 24 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-clm/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Junta de Castilla-La Mancha',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Junta de Castilla-La Mancha | Vence',
    description: 'Tests de los 24 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-clm/test`,
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
