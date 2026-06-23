const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo de la Comunidad de Madrid 2026 | Vence',
  description: 'Temario completo de Administrativo de la Comunidad de Madrid actualizado 2026. 47 temas oficiales con teoría.',
  keywords: [
    'temario administrativo comunidad de madrid',
    'temario administrativo comunidad de madrid 2026',
    'temario oficial administrativo comunidad de madrid',
    'temario oposiciones comunidad de madrid',
    'temas administrativo comunidad de madrid',
    'teoría administrativo comunidad de madrid',
    'temario gratis administrativo comunidad de madrid'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo de la Comunidad de Madrid 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Administrativo de la Comunidad de Madrid. 47 temas oficiales con teoría completa.',
    url: `${SITE_URL}/administrativo-madrid/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo de la Comunidad de Madrid',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo de la Comunidad de Madrid | Vence',
    description: 'Temario completo y actualizado 2026. 47 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-madrid/temario`,
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
