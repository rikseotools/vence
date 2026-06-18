const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Junta Jaén 2026 | Vence',
  description: 'Temario completo del Cuerpo Administrativo de la Junta de Comunidades de Jaén actualizado 2026. 40 temas oficiales organizados en 6 bloques.',
  keywords: [
    'temario administrativo diputación de jaén',
    'temario administrativo gobierno de diputación de jaén 2026',
    'temario oficial administrativo gobierno de diputación de jaén',
    'oposiciones administrativo diputación de jaén',
    'temario cuerpo administrativo diputación de jaén',
    'temas administrativo gobierno de diputación de jaén',
    'temario gratis administrativo diputación de jaén',
    '31 plazas administrativo diputación de jaén'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Junta Jaén 2026 | Vence',
    description: 'Accede al temario completo del Cuerpo Administrativo de la Junta de Comunidades de Jaén. 40 temas oficiales organizados en 6 bloques.',
    url: `${SITE_URL}/administrativo-diputacion-jaen/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Junta Jaén',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Junta Jaén | Vence',
    description: 'Temario completo y actualizado 2026. 40 temas oficiales del Cuerpo Administrativo.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-diputacion-jaen/temario`,
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
