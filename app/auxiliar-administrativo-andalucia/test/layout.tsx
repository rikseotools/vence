const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Junta de Andalucía 2026 | 22 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo Junta de Andalucía con los 22 temas oficiales del BOJA. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo andalucia',
    'tests auxiliar junta andalucia',
    'tests temas auxiliar andalucia',
    'test auxiliar administrativo andalucia 2026',
    'tests oposiciones andalucia',
    'preguntas auxiliar administrativo junta andalucia',
    'examen auxiliar andalucia',
    '22 temas auxiliar andalucia',
    'C2 junta de andalucia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Junta de Andalucía - 22 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo Junta de Andalucía. 22 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-andalucia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Junta de Andalucía',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Junta de Andalucía | Vence',
    description: 'Tests de los 22 temas oficiales del BOJA. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-andalucia/test`,
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
