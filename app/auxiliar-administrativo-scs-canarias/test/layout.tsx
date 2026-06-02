const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo del Servicio Canario de la Salud (SCS) | 22 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Servicio Canario de la Salud (SCS) con los 22 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo canarias',
    'tests auxiliar canarias',
    'tests temas auxiliar scs canarias',
    'test auxiliar administrativo canarias',
    'tests oposiciones gobierno de canarias',
    'preguntas auxiliar administrativo canarias',
    'examen auxiliar gobierno de canarias',
    '22 temas auxiliar canarias',
    'C2 gobierno de canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo del Servicio Canario de la Salud (SCS) - 22 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Servicio Canario de la Salud (SCS). 22 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-scs-canarias/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo del Servicio Canario de la Salud (SCS)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo del Servicio Canario de la Salud (SCS) | Vence',
    description: 'Tests de los 22 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-scs-canarias/test`,
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
