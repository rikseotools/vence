const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares 2026 | 24 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares con los 24 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo ayuntamiento de alcalá de henares',
    'tests auxiliar ayuntamiento de alcalá de henares',
    'tests temas auxiliar ayuntamiento de alcalá de henares',
    'test auxiliar administrativo alcala-henares 2026',
    'tests oposiciones ayuntamiento de alcalá de henares',
    'preguntas auxiliar administrativo ayuntamiento de alcalá de henares',
    'examen auxiliar ayuntamiento de alcalá de henares',
    '24 temas auxiliar ayuntamiento de alcalá de henares',
    'C2 ayuntamiento de alcalá de henares'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares - 24 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares. 24 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-alcala-henares/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares | Vence',
    description: 'Tests de los 24 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-alcala-henares/test`,
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
