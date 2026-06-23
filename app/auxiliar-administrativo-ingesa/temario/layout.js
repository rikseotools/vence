const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo del INGESA (Ceuta y Melilla) | Vence',
  description: 'Temario completo de Auxiliar Administrativo del INGESA (Ceuta y Melilla). 35 temas oficiales organizados en 2 bloques con teoria.',
  keywords: [
    'temario auxiliar administrativo ingesa',
    'temario auxiliar administrativo ceuta melilla',
    'temario oficial auxiliar administrativo ingesa',
    'temario oposiciones ingesa',
    'temas auxiliar administrativo ingesa',
    'teoria auxiliar administrativo ceuta melilla',
    'temario gratis auxiliar administrativo ingesa'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo del INGESA (Ceuta y Melilla) | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo del INGESA (Ceuta y Melilla). 35 temas oficiales con teoria completa.',
    url: `${SITE_URL}/auxiliar-administrativo-ingesa/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo del INGESA (Ceuta y Melilla)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo del INGESA (Ceuta y Melilla) | Vence',
    description: 'Temario completo y actualizado. 35 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ingesa/temario`,
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
