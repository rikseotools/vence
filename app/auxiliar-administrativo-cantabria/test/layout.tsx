const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Gobierno de Cantabria | 25 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar Administrativo del Gobierno de Cantabria con los 25 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar administrativo cantabria',
    'tests auxiliar cantabria',
    'tests temas auxiliar cantabria',
    'test auxiliar administrativo gobierno cantabria',
    'tests oposiciones cantabria',
    'preguntas auxiliar administrativo cantabria',
    'examen auxiliar cantabria',
    '25 temas auxiliar cantabria',
    'C2 gobierno cantabria'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Gobierno de Cantabria - 25 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar Administrativo del Gobierno de Cantabria. 25 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-cantabria/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Gobierno de Cantabria',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Gobierno de Cantabria | Vence',
    description: 'Tests de los 25 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-cantabria/test`,
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
