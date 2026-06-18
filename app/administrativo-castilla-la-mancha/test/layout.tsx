const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Cuerpo Administrativo Castilla-La Mancha 2026 | 36 Temas Oficiales | Vence',
  description: 'Tests de Cuerpo Administrativo Castilla-La Mancha con los 36 temas oficiales del DOCM. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo castilla-la mancha',
    'tests administrativo clm',
    'tests temas administrativo clm',
    'test administrativo clm 2026',
    'tests oposiciones castilla-la mancha',
    'preguntas administrativo clm',
    'examen administrativo castilla-la mancha',
    '36 temas administrativo clm c1',
    'C1 junta castilla-la mancha'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Cuerpo Administrativo Castilla-La Mancha - 36 Temas Oficiales | Vence',
    description: 'Practica con tests de Cuerpo Administrativo Castilla-La Mancha. 36 temas oficiales en 2 partes (común y específica), estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-castilla-la-mancha/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Cuerpo Administrativo Castilla-La Mancha',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Cuerpo Administrativo Castilla-La Mancha | Vence',
    description: 'Tests de los 36 temas oficiales del DOCM. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-castilla-la-mancha/test`,
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
