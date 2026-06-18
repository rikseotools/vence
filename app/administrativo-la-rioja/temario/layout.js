const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Junta La Rioja 2026 | Vence',
  description: 'Temario completo del Cuerpo Administrativo de la Junta de Comunidades de La Rioja actualizado 2026. 42 temas oficiales organizados en 6 bloques.',
  keywords: [
    'temario administrativo la rioja',
    'temario administrativo gobierno de la rioja 2026',
    'temario oficial administrativo gobierno de la rioja',
    'oposiciones administrativo la rioja',
    'temario cuerpo administrativo la rioja',
    'temas administrativo gobierno de la rioja',
    'temario gratis administrativo la rioja',
    '22 plazas administrativo la rioja'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Junta La Rioja 2026 | Vence',
    description: 'Accede al temario completo del Cuerpo Administrativo de la Junta de Comunidades de La Rioja. 42 temas oficiales organizados en 6 bloques.',
    url: `${SITE_URL}/administrativo-la-rioja/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Junta La Rioja',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Junta La Rioja | Vence',
    description: 'Temario completo y actualizado 2026. 42 temas oficiales del Cuerpo Administrativo.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-la-rioja/temario`,
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
