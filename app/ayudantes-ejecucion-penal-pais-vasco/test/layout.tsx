const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Ayudantes en Ejecución Penal (Euskadi) 2026 | 53 Temas Oficiales | Vence',
  description: 'Tests de Ayudantes en Ejecución Penal (Euskadi) con los 53 temas oficiales del IVAP. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo C1.',
  keywords: [
    'test ayudantes ejecucion penal euskadi',
    'tests administrativo ule',
    'tests temas administrativo ule',
    'test administrativo ule 2026',
    'tests oposiciones euskadi',
    'preguntas administrativo ule',
    'examen ayudantes ejecucion penal euskadi',
    '53 temas administrativo ule c1',
    'C1 euskadi'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Ayudantes en Ejecución Penal (Euskadi) - 53 Temas Oficiales | Vence',
    description: 'Practica con tests de Ayudantes en Ejecución Penal (Euskadi). 53 temas oficiales en 2 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/ayudantes-ejecucion-penal-pais-vasco/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Ayudantes en Ejecución Penal (Euskadi)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Ayudantes en Ejecución Penal (Euskadi) | Vence',
    description: 'Tests de los 53 temas oficiales del IVAP. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/ayudantes-ejecucion-penal-pais-vasco/test`,
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
