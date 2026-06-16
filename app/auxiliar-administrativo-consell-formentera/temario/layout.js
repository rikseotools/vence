const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo del Consell Insular de Formentera 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo del Consell Insular de Formentera actualizado 2026. 20 temas oficiales organizados en 2 bloques con teoría.',
  keywords: [
    'temario auxiliar administrativo ayuntamiento formentera',
    'temario auxiliar ayuntamiento formentera 2026',
    'temario oficial auxiliar ayuntamiento formentera',
    'temario oposiciones ayuntamiento formentera',
    'temas auxiliar administrativo ayuntamiento formentera',
    'teoría auxiliar ayuntamiento formentera',
    'temario gratis auxiliar ayuntamiento formentera'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo del Consell Insular de Formentera 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo del Consell Insular de Formentera. 20 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-consell-formentera/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo del Consell Insular de Formentera',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo del Consell Insular de Formentera | Vence',
    description: 'Temario completo y actualizado 2026. 20 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-consell-formentera/temario`,
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
