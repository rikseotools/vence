const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Cuerpo Administrativo La Rioja 2026 | 42 temas Oficiales | Vence',
  description: 'Tests de Cuerpo Administrativo La Rioja con los 42 temas oficiales del DOCM. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo la rioja',
    'tests administrativo la rioja',
    'tests temas administrativo la rioja',
    'test administrativo la rioja 2026',
    'tests oposiciones la rioja',
    'preguntas administrativo la rioja',
    'examen administrativo la rioja',
    '42 temas administrativo la rioja c1',
    'C1 gobierno de la rioja'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Cuerpo Administrativo La Rioja - 42 temas Oficiales | Vence',
    description: 'Practica con tests de Cuerpo Administrativo La Rioja. 42 temas oficiales en 6 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-la-rioja/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Cuerpo Administrativo La Rioja',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Cuerpo Administrativo La Rioja | Vence',
    description: 'Tests de los 42 temas oficiales del DOCM. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-la-rioja/test`,
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
