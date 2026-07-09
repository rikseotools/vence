const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Enfermero SCS Canarias 2025 | 50 Temas Oficiales | Vence',
  description: 'Tests de Enfermero/a del Servicio Canario de la Salud con los 50 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo A2.',
  keywords: [
    'test enfermero scs',
    'tests enfermero canarias',
    'tests enfermero scs 2025',
    'tests oposiciones enfermero canarias',
    'preguntas enfermero scs',
    'examen enfermero canarias',
    '50 temas enfermero scs',
    'grupo A2 enfermero canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Enfermero SCS Canarias - 50 Temas Oficiales | Vence',
    description: 'Practica con tests de Enfermero/a del Servicio Canario de la Salud. 50 temas oficiales, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/enfermero-scs-canarias/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Enfermero SCS Canarias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Enfermero SCS Canarias | Vence',
    description: 'Tests de los 50 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/enfermero-scs-canarias/test`,
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
