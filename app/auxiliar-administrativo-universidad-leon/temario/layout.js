const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Universidad de León 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Universidad de León actualizado 2026. 21 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo universidad de león',
    'temario auxiliar universidad de león 2026',
    'temario oficial auxiliar universidad de león',
    'temario oposiciones universidad de león',
    'temas auxiliar administrativo universidad de león',
    'teoría auxiliar universidad de león',
    'temario gratis auxiliar universidad de león'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Universidad de León 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Universidad de León. 21 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-universidad-leon/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Universidad de León',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Universidad de León | Vence',
    description: 'Temario completo y actualizado 2026. 21 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-universidad-leon/temario`,
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
