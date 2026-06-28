const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo Junta de Extremadura | 30 temas Oficiales | Vence',
  description: 'Tests de Administrativo Junta de Extremadura con los 30 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo extremadura',
    'tests administrativo extremadura',
    'tests temas administrativo extremadura',
    'test administrativo junta extremadura',
    'tests oposiciones extremadura',
    'preguntas administrativo extremadura',
    'examen administrativo extremadura',
    '30 temas administrativo extremadura',
    'C1 junta extremadura'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo Junta de Extremadura - 30 temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo Junta de Extremadura. 30 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-extremadura/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativo Junta de Extremadura',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo Junta de Extremadura | Vence',
    description: 'Tests de los 30 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-extremadura/test`,
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
