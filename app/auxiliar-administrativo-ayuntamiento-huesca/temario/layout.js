const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo del Ayuntamiento de Huesca 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo del Ayuntamiento de Huesca actualizado 2026. 28 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo ayuntamiento de huesca',
    'temario auxiliar ayuntamiento de huesca 2026',
    'temario oficial auxiliar ayuntamiento de huesca',
    'temario oposiciones ayuntamiento de huesca',
    'temas auxiliar administrativo ayuntamiento de huesca',
    'teoría auxiliar ayuntamiento de huesca',
    'temario gratis auxiliar ayuntamiento de huesca'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo del Ayuntamiento de Huesca 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo del Ayuntamiento de Huesca. 28 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-huesca/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo del Ayuntamiento de Huesca',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo del Ayuntamiento de Huesca | Vence',
    description: 'Temario completo y actualizado 2026. 28 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-huesca/temario`,
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
