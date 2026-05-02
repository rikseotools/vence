const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Celador SCS Canarias 2025 | 14 Temas Oficiales | Vence',
  description: 'Temario oficial de Celador del Servicio Canario de Salud. 14 temas sobre funciones del celador en instituciones sanitarias.',
  keywords: [
    'temario celador scs',
    'temario celador canarias',
    'temario celador scs 2025',
    'temario oficial celador canarias',
    'temas celador scs',
    'teoria celador servicio canario salud',
    'temario gratis celador canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Celador SCS Canarias - 14 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Celador del Servicio Canario de Salud. 14 temas oficiales segun BOC.',
    url: `${SITE_URL}/celador-scs-canarias/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Celador SCS Canarias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Celador SCS Canarias | Vence',
    description: 'Temario completo y actualizado 2025. 14 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-scs-canarias/temario`,
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
