const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Ayuntamiento de Granada 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Ayuntamiento de Granada actualizado 2026. 22 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo ayuntamiento de granada',
    'temario auxiliar ayuntamiento de granada 2026',
    'temario oficial auxiliar ayuntamiento de granada',
    'temario oposiciones ayuntamiento de granada',
    'temas auxiliar administrativo ayuntamiento de granada',
    'teoría auxiliar ayuntamiento de granada',
    'temario gratis auxiliar ayuntamiento de granada'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Ayuntamiento de Granada 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Ayuntamiento de Granada. 22 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-granada/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Ayuntamiento de Granada',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Ayuntamiento de Granada | Vence',
    description: 'Temario completo y actualizado 2026. 22 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-granada/temario`,
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
