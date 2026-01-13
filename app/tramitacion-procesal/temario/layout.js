const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Tramitación Procesal 2026 | Vence',
  description: 'Temario completo de Tramitación Procesal actualizado 2026. 37 temas oficiales organizados en 3 bloques con teoría y PDFs descargables.',
  keywords: [
    'temario tramitacion procesal',
    'temario tramitacion procesal 2026',
    'temario oficial tramitacion procesal',
    'temario administracion justicia',
    'temario oposiciones tramitacion',
    'pdf temario tramitacion procesal',
    'temas tramitacion procesal',
    'teoría tramitacion procesal',
    'temario gratis tramitacion'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Tramitación Procesal 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Tramitación Procesal. 37 temas oficiales con teoría completa.',
    url: `${SITE_URL}/tramitacion-procesal/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Tramitación Procesal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Tramitación Procesal | Vence',
    description: 'Temario completo y actualizado 2026. 37 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/tramitacion-procesal/temario`,
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
