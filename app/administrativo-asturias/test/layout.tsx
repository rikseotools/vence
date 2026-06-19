const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo Principado de Asturias | 38 Temas Oficiales | Vence',
  description: 'Tests de Administrativo Principado de Asturias con los 38 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo asturias',
    'tests administrativo asturias',
    'tests temas administrativo asturias',
    'test administrativo principado de asturias',
    'tests oposiciones asturias',
    'preguntas administrativo asturias',
    'examen administrativo asturias',
    '38 temas administrativo asturias',
    'C1 principado de asturias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo Principado de Asturias - 38 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo Principado de Asturias. 38 temas oficiales en 5 partes, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-asturias/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativo Principado de Asturias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo Principado de Asturias | Vence',
    description: 'Tests de los 38 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-asturias/test`,
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
