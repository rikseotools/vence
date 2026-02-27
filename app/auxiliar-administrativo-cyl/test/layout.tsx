const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Castilla y León 2026 | 28 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo Castilla y León con los 28 temas oficiales del BOCYL. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo castilla y leon',
    'tests auxiliar cyl',
    'tests temas auxiliar cyl',
    'test auxiliar administrativo cyl 2026',
    'tests oposiciones castilla y leon',
    'preguntas auxiliar administrativo cyl',
    'examen auxiliar castilla y leon',
    '28 temas auxiliar cyl',
    'C2 junta castilla y leon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Castilla y León - 28 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo Castilla y León. 28 temas oficiales en 2 grupos, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-cyl/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Castilla y León',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Castilla y León | Vence',
    description: 'Tests de los 28 temas oficiales del BOCYL. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-cyl/test`,
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
