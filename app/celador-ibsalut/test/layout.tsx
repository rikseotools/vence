const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Celador IB-Salut Balears 2025 | 17 Temas Oficiales | Vence',
  description: 'Tests de Celador del IB-Salut con los 20 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo E.',
  keywords: [
    'test celador ibsalut',
    'tests celador illes-balears',
    'tests celador ibsalut 2025',
    'tests oposiciones celador illes-balears',
    'preguntas celador ibsalut',
    'examen celador illes-balears',
    '20 temas celador ibsalut',
    'grupo E celador illes-balears'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Celador IB-Salut Balears - 17 Temas Oficiales | Vence',
    description: 'Practica con tests de Celador del IB-Salut. 20 temas oficiales, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/celador-ibsalut/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Celador IB-Salut Balears',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Celador IB-Salut Balears | Vence',
    description: 'Tests de los 20 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-ibsalut/test`,
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
