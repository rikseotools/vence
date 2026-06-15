const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Córdoba 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Diputación Provincial de Córdoba actualizado 2026. 20 temas oficiales organizados en 2 bloques con teoría.',
  keywords: [
    'temario auxiliar administrativo diputacion cordoba',
    'temario auxiliar diputacion cordoba 2026',
    'temario oficial auxiliar diputacion cordoba',
    'temario oposiciones diputacion cordoba',
    'temas auxiliar administrativo diputacion cordoba',
    'teoría auxiliar diputacion cordoba',
    'temario gratis auxiliar diputacion cordoba'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Córdoba 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Diputación Provincial de Córdoba. 20 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-diputacion-cordoba/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Diputación Provincial de Córdoba',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Córdoba | Vence',
    description: 'Temario completo y actualizado 2026. 20 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-diputacion-cordoba/temario`,
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
