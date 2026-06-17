const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Cuerpo Administrativo Castilla y León 2026 | 41 Temas Oficiales | Vence',
  description: 'Tests de Cuerpo Administrativo Castilla y León con los 41 temas oficiales del BOCYL. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test auxiliar administrativo castilla y leon',
    'tests auxiliar cyl',
    'tests temas auxiliar cyl',
    'test auxiliar administrativo cyl 2026',
    'tests oposiciones castilla y leon',
    'preguntas auxiliar administrativo cyl',
    'examen auxiliar castilla y leon',
    '41 temas administrativo cyl c1',
    'C1 junta castilla y leon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Cuerpo Administrativo Castilla y León - 41 Temas Oficiales | Vence',
    description: 'Practica con tests de Cuerpo Administrativo Castilla y León. 41 temas oficiales en 5 grupos, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-castilla-leon/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Cuerpo Administrativo Castilla y León',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Cuerpo Administrativo Castilla y León | Vence',
    description: 'Tests de los 41 temas oficiales del BOCYL. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-castilla-leon/test`,
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
