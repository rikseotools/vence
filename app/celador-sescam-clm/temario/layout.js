const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Celador SESCAM Castilla-La Mancha 2025 | 17 Temas Oficiales | Vence',
  description: 'Temario oficial de Celador del SESCAM. 15 temas sobre funciones del celador en instituciones sanitarias.',
  keywords: [
    'temario celador sescam clm',
    'temario celador castilla-la mancha',
    'temario celador sescam clm 2025',
    'temario oficial celador castilla-la mancha',
    'temas celador sescam clm',
    'teoria celador servicio gallego de salud',
    'temario gratis celador castilla-la mancha'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Celador SESCAM Castilla-La Mancha - 17 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Celador del SESCAM. 15 temas oficiales segun DOG.',
    url: `${SITE_URL}/celador-sescam-clm/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Celador SESCAM Castilla-La Mancha',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Celador SESCAM Castilla-La Mancha | Vence',
    description: 'Temario completo y actualizado 2025. 15 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-sescam-clm/temario`,
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
