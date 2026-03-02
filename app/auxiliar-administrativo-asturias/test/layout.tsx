const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Principado de Asturias | 25 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo Principado de Asturias con los 25 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo asturias',
    'tests auxiliar asturias',
    'tests temas auxiliar asturias',
    'test auxiliar administrativo principado asturias',
    'tests oposiciones asturias',
    'preguntas auxiliar administrativo asturias',
    'examen auxiliar asturias',
    '25 temas auxiliar asturias',
    'C2 principado asturias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Principado de Asturias - 25 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo Principado de Asturias. 25 temas oficiales en 3 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-asturias/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Principado de Asturias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Principado de Asturias | Vence',
    description: 'Tests de los 25 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-asturias/test`,
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
