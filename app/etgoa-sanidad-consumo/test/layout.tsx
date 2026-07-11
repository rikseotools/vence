const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests ETGOA Sanidad y Consumo 2026 | 120 Temas Oficiales | Vence',
  description: 'Tests de ETGOA Sanidad y Consumo con los 120 temas oficiales del BOE. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo A1.',
  keywords: [
    'test etgoa sanidad y consumo',
    'tests administrativo etgoa',
    'tests temas administrativo etgoa',
    'test administrativo etgoa 2026',
    'tests oposiciones organismos autonomos',
    'preguntas administrativo etgoa',
    'examen etgoa sanidad y consumo',
    '120 temas etgoa a1',
    'etgoa a1'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests ETGOA Sanidad y Consumo - 120 Temas Oficiales | Vence',
    description: 'Practica con tests de ETGOA Sanidad y Consumo. 120 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/etgoa-sanidad-consumo/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests ETGOA Sanidad y Consumo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests ETGOA Sanidad y Consumo | Vence',
    description: 'Tests de los 120 temas oficiales del BOE. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/etgoa-sanidad-consumo/test`,
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
