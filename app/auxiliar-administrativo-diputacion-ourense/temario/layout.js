const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Ourense 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Diputación Provincial de Ourense actualizado 2026. 20 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo diputación provincial de ourense',
    'temario auxiliar diputación provincial de ourense 2026',
    'temario oficial auxiliar diputación provincial de ourense',
    'temario oposiciones diputación provincial de ourense',
    'temas auxiliar administrativo diputación provincial de ourense',
    'teoría auxiliar diputación provincial de ourense',
    'temario gratis auxiliar diputación provincial de ourense'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Ourense 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Diputación Provincial de Ourense. 20 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-diputacion-ourense/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Diputación Provincial de Ourense',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Ourense | Vence',
    description: 'Temario completo y actualizado 2026. 20 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-diputacion-ourense/temario`,
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
