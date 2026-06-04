const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo del Servicio Murciano de Salud (SMS) | 24 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Servicio Murciano de Salud (SMS) con los 24 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo sms',
    'tests auxiliar sms',
    'tests temas auxiliar sms',
    'test auxiliar administrativo servicio murciano de salud',
    'tests oposiciones sms',
    'preguntas auxiliar administrativo sms',
    'examen auxiliar sms',
    '24 temas auxiliar sms',
    'C2 junta servicio murciano de salud'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo del Servicio Murciano de Salud (SMS) - 24 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Servicio Murciano de Salud (SMS). 24 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-sms/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo del Servicio Murciano de Salud (SMS)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo del Servicio Murciano de Salud (SMS) | Vence',
    description: 'Tests de los 24 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-sms/test`,
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
