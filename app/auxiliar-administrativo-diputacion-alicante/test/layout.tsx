const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Alicante 2026 | 20 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Diputación Provincial de Alicante con los 20 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo diputacion alicante',
    'tests auxiliar diputacion alicante',
    'tests temas auxiliar diputacion alicante',
    'test auxiliar administrativo alicante 2026',
    'tests oposiciones diputacion alicante',
    'preguntas auxiliar administrativo diputacion alicante',
    'examen auxiliar diputacion alicante',
    '20 temas auxiliar diputacion alicante',
    'C2 diputacion alicante'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Alicante - 20 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Diputación Provincial de Alicante. 20 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-diputacion-alicante/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Diputación Provincial de Alicante',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Alicante | Vence',
    description: 'Tests de los 20 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-diputacion-alicante/test`,
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
