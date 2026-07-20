const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Subalternos del Parlamento de Andalucía 2026 | Vence',
  description: 'Temario completo del Subalternos del Parlamento de Andalucía actualizado 2026. 15 temas oficiales organizados en 2 partes.',
  keywords: ['subalterno parlamento de andalucia', 'subalternos parlamento andalucia', 'subalterno parlamento andaluz', 'ordenanza parlamento de andalucia', 'oposicion subalterno parlamento andalucia'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Subalternos del Parlamento de Andalucía 2026 | Vence',
    description: 'Accede al temario completo del Subalternos del Parlamento de Andalucía. 15 temas oficiales organizados en 2 partes.',
    url: `${SITE_URL}/subalterno-parlamento-andalucia/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Subalternos del Parlamento de Andalucía',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Subalternos del Parlamento de Andalucía | Vence',
    description: 'Temario completo y actualizado 2026. 15 temas oficiales del Subalternos del Parlamento de Andalucía.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/subalterno-parlamento-andalucia/temario`,
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
