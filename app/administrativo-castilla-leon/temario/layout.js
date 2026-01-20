const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Junta Castilla y León 2026 | Vence',
  description: 'Temario completo del Cuerpo Administrativo de la Junta de Castilla y León actualizado 2026. 41 temas oficiales organizados en 5 grupos.',
  keywords: [
    'temario administrativo castilla y leon',
    'temario administrativo junta castilla leon 2026',
    'temario oficial administrativo jcyl',
    'oposiciones administrativo castilla leon',
    'temario cuerpo administrativo castilla leon',
    'temas administrativo junta castilla leon',
    'temario gratis administrativo castilla leon',
    '191 plazas administrativo castilla leon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Junta Castilla y León 2026 | Vence',
    description: 'Accede al temario completo del Cuerpo Administrativo de la Junta de Castilla y León. 41 temas oficiales organizados en 5 grupos.',
    url: `${SITE_URL}/administrativo-castilla-leon/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Junta Castilla y León',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Junta Castilla y León | Vence',
    description: 'Temario completo y actualizado 2026. 41 temas oficiales del Cuerpo Administrativo.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-castilla-leon/temario`,
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
