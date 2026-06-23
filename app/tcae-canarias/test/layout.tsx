const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests TCAE Canarias 2025 | 24 Temas Oficiales | Vence',
  description: 'Tests de TCAE (Auxiliar de Enfermeria) del Servicio Canario de Salud con los 24 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test tcae canarias',
    'tests auxiliar enfermeria canarias',
    'tests tcae canarias 2025',
    'tests oposiciones tcae canarias',
    'preguntas tcae canarias',
    'examen tcae canarias',
    '24 temas tcae canarias',
    'C2 servicio canario salud'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests TCAE Canarias - 24 Temas Oficiales | Vence',
    description: 'Practica con tests de TCAE del Servicio Canario de Salud. 24 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/tcae-canarias/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests TCAE Canarias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests TCAE Canarias | Vence',
    description: 'Tests de los 24 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/tcae-canarias/test`,
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
