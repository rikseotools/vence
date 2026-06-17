const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Huesca 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Diputación Provincial de Huesca actualizado 2026. 23 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo diputación provincial de huesca',
    'temario auxiliar diputación provincial de huesca 2026',
    'temario oficial auxiliar diputación provincial de huesca',
    'temario oposiciones diputación provincial de huesca',
    'temas auxiliar administrativo diputación provincial de huesca',
    'teoría auxiliar diputación provincial de huesca',
    'temario gratis auxiliar diputación provincial de huesca'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Huesca 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Diputación Provincial de Huesca. 23 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-diputacion-huesca/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Diputación Provincial de Huesca',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Huesca | Vence',
    description: 'Temario completo y actualizado 2026. 23 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-diputacion-huesca/temario`,
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
