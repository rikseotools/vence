const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Universidad de Cádiz 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Universidad de Cádiz actualizado 2026. 27 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo universidad de cádiz',
    'temario auxiliar universidad de cádiz 2026',
    'temario oficial auxiliar universidad de cádiz',
    'temario oposiciones universidad de cádiz',
    'temas auxiliar administrativo universidad de cádiz',
    'teoría auxiliar universidad de cádiz',
    'temario gratis auxiliar universidad de cádiz'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Universidad de Cádiz 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Universidad de Cádiz. 27 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-universidad-cadiz/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Universidad de Cádiz',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Universidad de Cádiz | Vence',
    description: 'Temario completo y actualizado 2026. 27 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-universidad-cadiz/temario`,
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
