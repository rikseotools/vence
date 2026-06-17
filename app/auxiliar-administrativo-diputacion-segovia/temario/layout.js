const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Segovia 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Diputación Provincial de Segovia actualizado 2026. 30 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo diputación provincial de segovia',
    'temario auxiliar diputación provincial de segovia 2026',
    'temario oficial auxiliar diputación provincial de segovia',
    'temario oposiciones diputación provincial de segovia',
    'temas auxiliar administrativo diputación provincial de segovia',
    'teoría auxiliar diputación provincial de segovia',
    'temario gratis auxiliar diputación provincial de segovia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Segovia 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Diputación Provincial de Segovia. 30 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-diputacion-segovia/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Diputación Provincial de Segovia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Segovia | Vence',
    description: 'Temario completo y actualizado 2026. 30 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-diputacion-segovia/temario`,
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
