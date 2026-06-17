const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Ávila 2026 | 30 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Diputación Provincial de Ávila con los 30 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo diputacion avila',
    'tests auxiliar diputacion avila',
    'tests temas auxiliar diputacion avila',
    'test auxiliar administrativo avila 2026',
    'tests oposiciones diputacion avila',
    'preguntas auxiliar administrativo diputacion avila',
    'examen auxiliar diputacion avila',
    '30 temas auxiliar diputacion avila',
    'C2 diputacion avila'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Ávila - 30 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Diputación Provincial de Ávila. 30 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-diputacion-avila/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Diputación Provincial de Ávila',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Ávila | Vence',
    description: 'Tests de los 30 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-diputacion-avila/test`,
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
