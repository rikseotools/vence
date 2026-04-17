const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Personal Operativo de Correos 2026 | Vence',
  description: 'Temario completo de Personal Operativo de Correos actualizado 2026. 12 temas oficiales organizados en 2 bloques con teoría.',
  keywords: [
    'temario correos personal operativo',
    'temario correos 2026',
    'temario oficial correos',
    'temario oposiciones correos',
    'temas correos reparto',
    'temario correos gratis',
    'oposiciones correos temario'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Personal Operativo de Correos 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Personal Operativo de Correos. 12 temas oficiales con teoría completa.',
    url: `${SITE_URL}/correos-personal-operativo/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Personal Operativo de Correos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Personal Operativo de Correos | Vence',
    description: 'Temario completo y actualizado 2026. 12 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/correos-personal-operativo/temario`,
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
