const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo Generalitat Valenciana C1-01 | 35 Temas Oficiales | Vence',
  description: 'Tests de Administrativo Generalitat Valenciana C1-01 con los 35 temas oficiales del DOGV (Conv. 58/26). Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo valencia',
    'tests administrativo gva',
    'tests temas administrativo valencia',
    'test administrativo generalitat valenciana',
    'tests oposiciones administrativo valencia',
    'preguntas administrativo gva',
    'examen administrativo c1-01',
    '35 temas administrativo gva',
    'C1 generalitat valenciana',
    'convocatoria 58/26',
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo Generalitat Valenciana C1-01 — 35 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo Generalitat Valenciana C1-01. 35 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-gva/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence — Tests Administrativo Generalitat Valenciana C1-01',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo Generalitat Valenciana C1-01 | Vence',
    description: 'Tests de los 35 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-gva/test`,
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
