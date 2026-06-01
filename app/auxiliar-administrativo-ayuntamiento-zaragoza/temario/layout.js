const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Ayuntamiento de Zaragoza 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo del Ayuntamiento de Zaragoza actualizado 2026. 25 temas oficiales organizados en 3 bloques con teoría.',
  keywords: [
    'temario auxiliar administrativo ayuntamiento zaragoza',
    'temario auxiliar ayuntamiento zaragoza 2026',
    'temario oficial auxiliar ayuntamiento zaragoza',
    'temario oposiciones ayuntamiento zaragoza',
    'temas auxiliar administrativo ayuntamiento zaragoza',
    'teoría auxiliar ayuntamiento zaragoza',
    'temario gratis auxiliar ayuntamiento zaragoza'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Ayuntamiento de Zaragoza 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo del Ayuntamiento de Zaragoza. 25 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-zaragoza/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo Ayuntamiento de Zaragoza',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Ayuntamiento de Zaragoza | Vence',
    description: 'Temario completo y actualizado 2026. 25 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-zaragoza/temario`,
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
