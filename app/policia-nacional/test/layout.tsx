const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Policía Nacional 2026 | 45 Temas Oficiales | Vence',
  description: 'Tests de Policía Nacional con los 45 temas oficiales. Derecho, Seguridad, TIC, Inglés y Ortografía. Preguntas personalizables y seguimiento de progreso.',
  keywords: [
    'test policía nacional',
    'tests policía nacional 2026',
    'test oposiciones policía nacional',
    'preguntas policía nacional',
    'examen policía nacional',
    '45 temas policía nacional',
    'test escala básica',
    'test derecho penal policía nacional',
    'test ingles policía nacional'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Policía Nacional - 45 Temas Oficiales | Vence',
    description: 'Practica con tests de Policía Nacional. 45 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/policia-nacional/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Policía Nacional',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Policía Nacional | Vence',
    description: 'Tests de los 45 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/policia-nacional/test`,
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
