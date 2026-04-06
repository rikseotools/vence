const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Gobierno de La Rioja | 23 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Gobierno de La Rioja con los 23 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo la rioja',
    'tests auxiliar la rioja',
    'tests temas auxiliar la rioja',
    'test auxiliar administrativo gobierno la rioja',
    'tests oposiciones la rioja',
    'preguntas auxiliar administrativo la rioja',
    'examen auxiliar la rioja',
    '23 temas auxiliar la rioja',
    'C2 gobierno la rioja'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Gobierno de La Rioja - 23 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Gobierno de La Rioja. 23 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-la-rioja/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Gobierno de La Rioja',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Gobierno de La Rioja | Vence',
    description: 'Tests de los 23 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-la-rioja/test`,
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
