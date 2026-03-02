const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo DGA Aragon | 20 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo de Aragon (DGA) con los 20 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo aragon',
    'tests auxiliar aragon',
    'tests temas auxiliar aragon',
    'test auxiliar administrativo dga',
    'tests oposiciones aragon',
    'preguntas auxiliar administrativo aragon',
    'examen auxiliar aragon',
    '20 temas auxiliar aragon',
    'C2 dga aragon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo DGA Aragon - 20 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo de Aragon (DGA). 20 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-aragon/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo DGA Aragon',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo DGA Aragon | Vence',
    description: 'Tests de los 20 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-aragon/test`,
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
