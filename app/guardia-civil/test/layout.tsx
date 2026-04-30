const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Guardia Civil 2026 | 25 Temas Oficiales | Vence',
  description: 'Tests de Guardia Civil con los 25 temas oficiales. Derecho, Seguridad, TIC, Inglés y Ortografía. Preguntas personalizables y seguimiento de progreso.',
  keywords: [
    'test guardia civil',
    'tests guardia civil 2026',
    'test oposiciones guardia civil',
    'preguntas guardia civil',
    'examen guardia civil',
    '25 temas guardia civil',
    'test cabos y guardias',
    'test derecho penal guardia civil',
    'test ingles guardia civil'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Guardia Civil - 25 Temas Oficiales | Vence',
    description: 'Practica con tests de Guardia Civil. 25 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/guardia-civil/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Guardia Civil',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Guardia Civil | Vence',
    description: 'Tests de los 25 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/guardia-civil/test`,
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
