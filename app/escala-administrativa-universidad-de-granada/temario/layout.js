const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Escala Administrativa - Universidad de Granada 2026 | Vence',
  description: 'Temario completo de Escala Administrativa - Universidad de Granada actualizado 2026. 28 temas oficiales con teoría.',
  keywords: [
    'temario escala administrativa universidad de granada',
    'temario administrativa universidad de granada 2026',
    'temario oficial administrativa universidad de granada',
    'temario oposiciones universidad de granada',
    'temas escala administrativa universidad de granada',
    'teoría administrativa universidad de granada',
    'temario gratis administrativa universidad de granada'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Escala Administrativa - Universidad de Granada 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Escala Administrativa - Universidad de Granada. 28 temas oficiales con teoría completa.',
    url: `${SITE_URL}/escala-administrativa-universidad-de-granada/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Escala Administrativa - Universidad de Granada',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Escala Administrativa - Universidad de Granada | Vence',
    description: 'Temario completo y actualizado 2026. 28 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/escala-administrativa-universidad-de-granada/temario`,
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
