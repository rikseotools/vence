const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Tramitación Procesal 2026 | 37 Temas Oficiales | Vence',
  description: 'Tests de Tramitación Procesal con los 37 temas oficiales del BOE. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test tramitacion procesal',
    'tests tramitacion procesal',
    'tests temas tramitacion',
    'test tramitacion procesal 2026',
    'tests oposiciones tramitacion',
    'preguntas tramitacion procesal',
    'examen tramitacion procesal',
    'tests gratis tramitacion',
    '37 temas tramitacion',
    'C1 administracion justicia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Tramitación Procesal - 37 Temas Oficiales | Vence',
    description: 'Practica con tests de Tramitación Procesal. 37 temas oficiales en 3 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/tramitacion-procesal/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Tramitación Procesal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Tramitación Procesal | Vence',
    description: 'Tests de los 37 temas oficiales del BOE. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/tramitacion-procesal/test`,
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
