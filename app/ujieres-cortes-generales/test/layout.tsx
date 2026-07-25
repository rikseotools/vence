const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Cuerpo de Ujieres de las Cortes Generales 2026 | 17 Temas Oficiales | Vence',
  description: 'Tests de Cuerpo de Ujieres de las Cortes Generales con los 17 temas oficiales del BOE. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo C2.',
  keywords: ['ujieres cortes generales', 'ujier cortes generales', 'cuerpo de ujieres', 'ujier congreso de los diputados', 'ujier senado', 'ujieres parlamento', 'oposicion ujier', 'ujieres congreso'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Cuerpo de Ujieres de las Cortes Generales - 17 Temas Oficiales | Vence',
    description: 'Practica con tests de Cuerpo de Ujieres de las Cortes Generales. 17 temas oficiales en 1 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/ujieres-cortes-generales/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Cuerpo de Ujieres de las Cortes Generales',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Cuerpo de Ujieres de las Cortes Generales | Vence',
    description: 'Tests de los 17 temas oficiales del BOE. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/ujieres-cortes-generales/test`,
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

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
