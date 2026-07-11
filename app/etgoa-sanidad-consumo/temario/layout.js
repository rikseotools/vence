const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario ETGOA Sanidad y Consumo 2026 | Vence',
  description: 'Temario completo del Escala Técnica de Gestión de Organismos Autónomos actualizado 2026. 120 temas oficiales organizados en 2 bloques.',
  keywords: [
    'temario etgoa sanidad y consumo',
    'temario etgoa sanidad y consumo 2026',
    'temario oficial administrativo etgoa',
    'oposiciones etgoa sanidad y consumo',
    'temario etgoa sanidad y consumo',
    'temas etgoa sanidad y consumo',
    'temario gratis etgoa sanidad y consumo',
    '87 plazas etgoa sanidad y consumo'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario ETGOA Sanidad y Consumo 2026 | Vence',
    description: 'Accede al temario completo del Escala Técnica de Gestión de Organismos Autónomos. 120 temas oficiales organizados en 2 bloques.',
    url: `${SITE_URL}/etgoa-sanidad-consumo/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario ETGOA Sanidad y Consumo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario ETGOA Sanidad y Consumo | Vence',
    description: 'Temario completo y actualizado 2026. 120 temas oficiales del ETGOA Sanidad y Consumo.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/etgoa-sanidad-consumo/temario`,
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

export default function TemarioLayout({ children }) {
  return children
}
