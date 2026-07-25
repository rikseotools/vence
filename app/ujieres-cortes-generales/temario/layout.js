const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Cuerpo de Ujieres de las Cortes Generales 2026 | Vence',
  description: 'Temario completo del Cuerpo de Ujieres de las Cortes Generales actualizado 2026. 17 temas oficiales organizados en 1 partes.',
  keywords: ['ujieres cortes generales', 'ujier cortes generales', 'cuerpo de ujieres', 'ujier congreso de los diputados', 'ujier senado', 'ujieres parlamento', 'oposicion ujier', 'ujieres congreso'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Cuerpo de Ujieres de las Cortes Generales 2026 | Vence',
    description: 'Accede al temario completo del Cuerpo de Ujieres de las Cortes Generales. 17 temas oficiales organizados en 1 partes.',
    url: `${SITE_URL}/ujieres-cortes-generales/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Cuerpo de Ujieres de las Cortes Generales',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Cuerpo de Ujieres de las Cortes Generales | Vence',
    description: 'Temario completo y actualizado 2026. 17 temas oficiales del Cuerpo de Ujieres de las Cortes Generales.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/ujieres-cortes-generales/temario`,
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
