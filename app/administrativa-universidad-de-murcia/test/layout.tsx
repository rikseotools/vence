const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativa - Universidad de Murcia 2026 | 12 Temas Oficiales | Vence',
  description: 'Tests de Administrativa - Universidad de Murcia con los 18 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test técnico auxiliar (auxiliar de servicios) universidad de murcia',
    'tests auxiliar universidad de murcia',
    'tests temas auxiliar universidad de murcia',
    'test técnico auxiliar servicios murcia 2026',
    'tests oposiciones universidad de murcia',
    'preguntas técnico auxiliar servicios universidad de murcia',
    'examen auxiliar universidad de murcia',
    '18 temas auxiliar universidad de murcia',
    'C2 universidad de murcia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativa - Universidad de Murcia - 12 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativa - Universidad de Murcia. 18 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativa-universidad-de-murcia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativa - Universidad de Murcia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativa - Universidad de Murcia | Vence',
    description: 'Tests de los 18 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativa-universidad-de-murcia/test`,
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
