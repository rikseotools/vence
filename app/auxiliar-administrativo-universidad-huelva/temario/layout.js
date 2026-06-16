const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Universidad de Huelva 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Universidad de Huelva actualizado 2026. 17 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo universidad de huelva',
    'temario auxiliar universidad de huelva 2026',
    'temario oficial auxiliar universidad de huelva',
    'temario oposiciones universidad de huelva',
    'temas auxiliar administrativo universidad de huelva',
    'teoría auxiliar universidad de huelva',
    'temario gratis auxiliar universidad de huelva'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Universidad de Huelva 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Universidad de Huelva. 17 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-universidad-huelva/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Universidad de Huelva',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Universidad de Huelva | Vence',
    description: 'Temario completo y actualizado 2026. 17 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-universidad-huelva/temario`,
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
