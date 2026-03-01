const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Xunta de Galicia | 17 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo Xunta de Galicia con los 17 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo galicia',
    'tests auxiliar galicia',
    'tests temas auxiliar galicia',
    'test auxiliar administrativo xunta de galicia',
    'tests oposiciones galicia',
    'preguntas auxiliar administrativo galicia',
    'examen auxiliar galicia',
    '17 temas auxiliar galicia',
    'C2 xunta de galicia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Xunta de Galicia - 17 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo Xunta de Galicia. 17 temas oficiales en 2 partes, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-galicia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Xunta de Galicia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Xunta de Galicia | Vence',
    description: 'Tests de los 17 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-galicia/test`,
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
