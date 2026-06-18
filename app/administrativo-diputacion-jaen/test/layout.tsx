const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Cuerpo Administrativo Diputación de Jaén 2026 | 40 temas Oficiales | Vence',
  description: 'Tests de Cuerpo Administrativo Diputación de Jaén con los 40 temas oficiales del DOCM. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo diputación de jaén',
    'tests administrativo diputación de jaén',
    'tests temas administrativo diputación de jaén',
    'test administrativo diputación de jaén 2026',
    'tests oposiciones diputación de jaén',
    'preguntas administrativo diputación de jaén',
    'examen administrativo diputación de jaén',
    '40 temas administrativo diputación de jaén c1',
    'C1 gobierno de diputación de jaén'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Cuerpo Administrativo Diputación de Jaén - 40 temas Oficiales | Vence',
    description: 'Practica con tests de Cuerpo Administrativo Diputación de Jaén. 40 temas oficiales en 6 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-diputacion-jaen/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Cuerpo Administrativo Diputación de Jaén',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Cuerpo Administrativo Diputación de Jaén | Vence',
    description: 'Tests de los 40 temas oficiales del DOCM. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-diputacion-jaen/test`,
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
