const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxilio Judicial 2026 | Vence',
  description: 'Temario completo de Auxilio Judicial actualizado 2026. 26 temas oficiales organizados en 3 bloques con teoría y PDFs descargables.',
  keywords: [
    'temario auxilio judicial',
    'temario auxilio judicial 2026',
    'temario oficial auxilio judicial',
    'temario administracion justicia',
    'temario oposiciones auxilio judicial',
    'pdf temario auxilio judicial',
    'temas auxilio judicial',
    'teoría auxilio judicial',
    'temario gratis auxilio judicial'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxilio Judicial 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxilio Judicial. 26 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxilio-judicial/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxilio Judicial',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxilio Judicial | Vence',
    description: 'Temario completo y actualizado 2026. 26 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxilio-judicial/temario`,
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
