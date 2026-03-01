const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Junta de Extremadura | 25 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo Junta de Extremadura con los 25 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo extremadura',
    'tests auxiliar extremadura',
    'tests temas auxiliar extremadura',
    'test auxiliar administrativo junta extremadura',
    'tests oposiciones extremadura',
    'preguntas auxiliar administrativo extremadura',
    'examen auxiliar extremadura',
    '25 temas auxiliar extremadura',
    'C2 junta extremadura'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Junta de Extremadura - 25 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo Junta de Extremadura. 25 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-extremadura/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Junta de Extremadura',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Junta de Extremadura | Vence',
    description: 'Tests de los 25 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-extremadura/test`,
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
