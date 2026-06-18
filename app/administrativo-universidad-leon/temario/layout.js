const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Universidad de León 2026 | Vence',
  description: 'Temario completo del Escala Administrativa de la Universidad de León actualizado 2026. 25 temas oficiales organizados en 5 grupos.',
  keywords: [
    'temario administrativo universidad de leon',
    'temario administrativo universidad de leon 2026',
    'temario oficial administrativo ule',
    'oposiciones administrativo universidad de leon',
    'temario escala administrativa universidad de leon',
    'temas administrativo universidad de leon',
    'temario gratis administrativo universidad de leon',
    '11 plazas administrativo universidad de leon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Universidad de León 2026 | Vence',
    description: 'Accede al temario completo del Escala Administrativa de la Universidad de León. 25 temas oficiales organizados en 5 grupos.',
    url: `${SITE_URL}/administrativo-universidad-leon/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Universidad de León',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Universidad de León | Vence',
    description: 'Temario completo y actualizado 2026. 25 temas oficiales del Escala Administrativa.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-universidad-leon/temario`,
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
