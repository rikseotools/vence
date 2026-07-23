const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Ordenanza del Ayuntamiento de Córdoba 2026 | Vence',
  description: 'Temario completo de Ordenanza del Ayuntamiento de Córdoba actualizado 2026. 20 temas oficiales organizados en 2 bloques con teoría.',
  keywords: [
    'temario auxiliar administrativo ayuntamiento cordoba',
    'temario auxiliar ayuntamiento cordoba 2026',
    'temario oficial auxiliar ayuntamiento cordoba',
    'temario oposiciones ayuntamiento cordoba',
    'temas auxiliar administrativo ayuntamiento cordoba',
    'teoría auxiliar ayuntamiento cordoba',
    'temario gratis auxiliar ayuntamiento cordoba'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Ordenanza del Ayuntamiento de Córdoba 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Ordenanza del Ayuntamiento de Córdoba. 20 temas oficiales con teoría completa.',
    url: `${SITE_URL}/ordenanza-ayuntamiento-cordoba/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Ordenanza del Ayuntamiento de Córdoba',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Ordenanza del Ayuntamiento de Córdoba | Vence',
    description: 'Temario completo y actualizado 2026. 20 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/ordenanza-ayuntamiento-cordoba/temario`,
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
