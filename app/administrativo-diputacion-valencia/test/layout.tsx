const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo Diputación de Valencia C1-01 | 40 Temas Oficiales | Vence',
  description: 'Tests de Administrativo Diputación de Valencia C1-01 con los 40 temas oficiales del DOGV (Conv. 58/26). Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo valencia',
    'tests administrativo diputación valencia',
    'tests temas administrativo valencia',
    'test administrativo Diputación de Valencia',
    'tests oposiciones administrativo valencia',
    'preguntas administrativo diputación valencia',
    'examen administrativo c1',
    '40 temas administrativo diputación valencia',
    'C1 Diputación de Valencia',
    'convocatoria 03/26',
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo Diputación de Valencia C1-01 — 40 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo Diputación de Valencia C1-01. 40 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-diputacion-valencia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence — Tests Administrativo Diputación de Valencia C1-01',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo Diputación de Valencia C1-01 | Vence',
    description: 'Tests de los 40 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-diputacion-valencia/test`,
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
