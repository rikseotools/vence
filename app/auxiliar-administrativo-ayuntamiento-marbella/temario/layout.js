const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Ayuntamiento de Marbella 2026 | Vence',
  description: 'Temario completo del Auxiliar Administrativo del Ayuntamiento de Marbella actualizado 2026. 27 temas oficiales organizados en 6 bloques.',
  keywords: [
    'temario auxiliar administrativo marbella',
    'temario auxiliar administrativo ayuntamiento de marbella 2026',
    'temario oficial auxiliar administrativo ayuntamiento de marbella',
    'oposiciones auxiliar administrativo marbella',
    'temario auxiliar administrativo ayuntamiento de marbella',
    'temas auxiliar administrativo ayuntamiento de marbella',
    'temario gratis auxiliar administrativo marbella',
    '17 plazas auxiliar administrativo marbella'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Ayuntamiento de Marbella 2026 | Vence',
    description: 'Accede al temario completo del Auxiliar Administrativo del Ayuntamiento de Marbella. 27 temas oficiales organizados en 6 bloques.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-marbella/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo Ayuntamiento de Marbella',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Ayuntamiento de Marbella | Vence',
    description: 'Temario completo y actualizado 2026. 27 temas oficiales del Auxiliar Administrativo.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-marbella/temario`,
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
