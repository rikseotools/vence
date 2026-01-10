const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo del Estado 2026 | Vence',
  description: 'Temario completo de Administrativo del Estado actualizado 2026. 45 temas oficiales organizados en 6 bloques con teoría y PDFs descargables.',
  keywords: [
    'temario administrativo estado',
    'temario administrativo 2026',
    'temario oficial administrativo estado',
    'constitución española temario',
    'temario oposiciones administrativo',
    'pdf temario administrativo estado',
    'temas administrativo estado',
    'teoría administrativo estado',
    'temario gratis administrativo'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo del Estado 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Administrativo del Estado. 45 temas oficiales con teoría completa y PDFs.',
    url: `${SITE_URL}/administrativo-estado/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo del Estado',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo del Estado | Vence',
    description: 'Temario completo y actualizado 2026. 45 temas oficiales con teoría y PDFs descargables.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-estado/temario`,
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
