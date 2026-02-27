const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo CARM 2026 | 16 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo CARM con los 16 temas oficiales del BORM. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo carm',
    'tests auxiliar carm murcia',
    'tests temas auxiliar carm',
    'test auxiliar administrativo murcia 2026',
    'tests oposiciones carm',
    'preguntas auxiliar administrativo murcia',
    'examen auxiliar carm',
    '16 temas auxiliar carm',
    'C2 region de murcia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo CARM - 16 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo CARM. 16 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-carm/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo CARM',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo CARM | Vence',
    description: 'Tests de los 16 temas oficiales del BORM. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-carm/test`,
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
