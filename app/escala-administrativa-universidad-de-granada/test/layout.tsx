const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Escala Administrativa - Universidad de Granada 2026 | 12 Temas Oficiales | Vence',
  description: 'Tests de Escala Administrativa - Universidad de Granada con los 28 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test escala administrativa universidad de granada',
    'tests administrativa universidad de granada',
    'tests temas administrativa universidad de granada',
    'test administrativa granada 2026',
    'tests oposiciones universidad de granada',
    'preguntas administrativa universidad de granada',
    'examen administrativa universidad de granada',
    '28 temas administrativa universidad de granada',
    'C1 universidad de granada'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Escala Administrativa - Universidad de Granada - 12 Temas Oficiales | Vence',
    description: 'Practica con tests de Escala Administrativa - Universidad de Granada. 28 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/escala-administrativa-universidad-de-granada/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Escala Administrativa - Universidad de Granada',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Escala Administrativa - Universidad de Granada | Vence',
    description: 'Tests de los 28 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/escala-administrativa-universidad-de-granada/test`,
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
