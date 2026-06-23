const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo del Gobierno de Cantabria 2026 | 40 Temas Oficiales | Vence',
  description: 'Tests de Administrativo del Gobierno de Cantabria con los 40 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo gobierno de cantabria',
    'tests administrativo gobierno de cantabria',
    'tests temas administrativo gobierno de cantabria',
    'test administrativo junta-de-cantabria 2026',
    'tests oposiciones gobierno de cantabria',
    'preguntas administrativo gobierno de cantabria',
    'examen administrativo gobierno de cantabria',
    '40 temas administrativo gobierno de cantabria',
    'C1 gobierno de cantabria'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo del Gobierno de Cantabria - 40 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo del Gobierno de Cantabria. 40 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-cantabria/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativo del Gobierno de Cantabria',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo del Gobierno de Cantabria | Vence',
    description: 'Tests de los 40 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-cantabria/test`,
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
