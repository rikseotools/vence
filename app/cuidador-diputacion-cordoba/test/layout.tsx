const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Cuidador/a de la Diputación Provincial de Córdoba 2026 | 20 Temas Oficiales | Vence',
  description: 'Tests de Cuidador/a de la Diputación Provincial de Córdoba con los 20 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test cuidador diputacion cordoba',
    'tests cuidador diputacion cordoba',
    'tests temas cuidador diputacion cordoba',
    'test cuidador cordoba 2026',
    'tests oposiciones cuidador cordoba',
    'preguntas cuidador diputacion cordoba',
    'examen cuidador diputacion cordoba',
    '20 temas cuidador diputacion cordoba',
    'C2 diputacion cordoba'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Cuidador/a de la Diputación Provincial de Córdoba - 20 Temas Oficiales | Vence',
    description: 'Practica con tests de Cuidador/a de la Diputación Provincial de Córdoba. 20 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/cuidador-diputacion-cordoba/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Cuidador/a de la Diputación Provincial de Córdoba',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Cuidador/a de la Diputación Provincial de Córdoba | Vence',
    description: 'Tests de los 20 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/cuidador-diputacion-cordoba/test`,
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
