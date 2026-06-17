const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo de la Junta de Andalucía 2026 | 42 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de la Junta de Andalucía con los 42 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo junta de andalucía',
    'tests auxiliar junta de andalucía',
    'tests temas auxiliar junta de andalucía',
    'test auxiliar administrativo junta-de-andalucia 2026',
    'tests oposiciones junta de andalucía',
    'preguntas auxiliar administrativo junta de andalucía',
    'examen auxiliar junta de andalucía',
    '42 temas auxiliar junta de andalucía',
    'C2 junta de andalucía'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Junta de Andalucía - 42 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de la Junta de Andalucía. 42 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-andalucia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo de la Junta de Andalucía',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo de la Junta de Andalucía | Vence',
    description: 'Tests de los 42 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-andalucia/test`,
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
