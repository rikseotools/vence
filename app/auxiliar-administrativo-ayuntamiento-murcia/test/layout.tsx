const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Ayuntamiento de Murcia 2026 | 20 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Ayuntamiento de Murcia con los 20 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo ayuntamiento murcia',
    'tests auxiliar ayuntamiento murcia',
    'tests temas auxiliar ayuntamiento murcia',
    'test auxiliar administrativo murcia 2026',
    'tests oposiciones ayuntamiento murcia',
    'preguntas auxiliar administrativo ayuntamiento murcia',
    'examen auxiliar ayuntamiento murcia',
    '20 temas auxiliar ayuntamiento murcia',
    'C2 ayuntamiento murcia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Murcia - 20 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Ayuntamiento de Murcia. 20 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-murcia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Ayuntamiento de Murcia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Murcia | Vence',
    description: 'Tests de los 20 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-murcia/test`,
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
