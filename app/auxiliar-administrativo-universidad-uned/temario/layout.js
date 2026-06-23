const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo UNED 2025 | 21 Temas Oficiales | Vence',
  description: 'Temario oficial de Auxiliar Administrativo de la UNED. 21 temas oficiales con teoria para la oposicion administrativa de la UNED.',
  keywords: [
    'temario auxiliar administrativo uned',
    'temario oposiciones uned',
    'temario auxiliar administrativo uned 2025',
    'temario oficial auxiliar administrativo uned',
    'temas auxiliar administrativo uned',
    'teoria auxiliar administrativo uned',
    'temario gratis auxiliar administrativo uned'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo UNED - 21 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Auxiliar Administrativo de la UNED. 21 temas oficiales segun BOE.',
    url: `${SITE_URL}/auxiliar-administrativo-universidad-uned/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo UNED',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo UNED | Vence',
    description: 'Temario completo y actualizado 2025. 21 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-universidad-uned/temario`,
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
