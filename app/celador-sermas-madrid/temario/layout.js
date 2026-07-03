const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Celador SERMAS Madrid 2025 | 17 Temas Oficiales | Vence',
  description: 'Temario oficial de Celador del SERMAS. 16 temas sobre funciones del celador en instituciones sanitarias.',
  keywords: [
    'temario celador sermas madrid',
    'temario celador madrid',
    'temario celador sermas madrid 2025',
    'temario oficial celador madrid',
    'temas celador sermas madrid',
    'teoria celador servicio gallego de salud',
    'temario gratis celador madrid'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Celador SERMAS Madrid - 17 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Celador del SERMAS. 16 temas oficiales segun DOG.',
    url: `${SITE_URL}/celador-sermas-madrid/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Celador SERMAS Madrid',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Celador SERMAS Madrid | Vence',
    description: 'Temario completo y actualizado 2025. 16 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-sermas-madrid/temario`,
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
