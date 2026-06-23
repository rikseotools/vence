const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo del INGESA (Ceuta y Melilla) | 35 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del INGESA (Ceuta y Melilla) con los 35 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo ingesa',
    'tests auxiliar administrativo ceuta melilla',
    'tests temas auxiliar administrativo ingesa',
    'test auxiliar administrativo ceuta melilla',
    'tests oposiciones ingesa',
    'preguntas auxiliar administrativo ingesa',
    'examen auxiliar administrativo ingesa',
    '35 temas auxiliar administrativo ingesa',
    'C2 ingesa'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo del INGESA (Ceuta y Melilla) - 35 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del INGESA (Ceuta y Melilla). 35 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-ingesa/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo del INGESA (Ceuta y Melilla)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo del INGESA (Ceuta y Melilla) | Vence',
    description: 'Tests de los 35 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ingesa/test`,
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
