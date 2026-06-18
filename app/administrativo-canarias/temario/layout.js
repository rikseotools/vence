const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Junta Canarias 2026 | Vence',
  description: 'Temario completo del Cuerpo Administrativo de la Junta de Comunidades de Canarias actualizado 2026. 30 temas oficiales organizados en 6 bloques.',
  keywords: [
    'temario administrativo canarias',
    'temario administrativo gobierno de canarias 2026',
    'temario oficial administrativo gobierno de canarias',
    'oposiciones administrativo canarias',
    'temario cuerpo administrativo canarias',
    'temas administrativo gobierno de canarias',
    'temario gratis administrativo canarias',
    '57 plazas administrativo canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Junta Canarias 2026 | Vence',
    description: 'Accede al temario completo del Cuerpo Administrativo de la Junta de Comunidades de Canarias. 30 temas oficiales organizados en 6 bloques.',
    url: `${SITE_URL}/administrativo-canarias/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Junta Canarias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Junta Canarias | Vence',
    description: 'Temario completo y actualizado 2026. 30 temas oficiales del Cuerpo Administrativo.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-canarias/temario`,
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
