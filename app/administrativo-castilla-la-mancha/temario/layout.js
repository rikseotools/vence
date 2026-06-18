const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Junta Castilla-La Mancha 2026 | Vence',
  description: 'Temario completo del Cuerpo Administrativo de la Junta de Comunidades de Castilla-La Mancha actualizado 2026. 36 temas oficiales organizados en 2 partes (común y específica).',
  keywords: [
    'temario administrativo castilla-la mancha',
    'temario administrativo junta castilla-la mancha 2026',
    'temario oficial administrativo jccm',
    'oposiciones administrativo castilla-la mancha',
    'temario cuerpo administrativo castilla-la mancha',
    'temas administrativo junta castilla-la mancha',
    'temario gratis administrativo castilla-la mancha',
    '23 plazas administrativo castilla-la mancha'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Junta Castilla-La Mancha 2026 | Vence',
    description: 'Accede al temario completo del Cuerpo Administrativo de la Junta de Comunidades de Castilla-La Mancha. 36 temas oficiales organizados en 2 partes (común y específica).',
    url: `${SITE_URL}/administrativo-castilla-la-mancha/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Junta Castilla-La Mancha',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Junta Castilla-La Mancha | Vence',
    description: 'Temario completo y actualizado 2026. 36 temas oficiales del Cuerpo Administrativo.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-castilla-la-mancha/temario`,
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
