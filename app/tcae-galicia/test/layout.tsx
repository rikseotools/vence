const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests TCAE Galicia 2025 | 31 Temas Oficiales | Vence',
  description: 'Tests de TCAE (Auxiliar de Enfermeria) del SERGAS con los 31 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test tcae sermas',
    'tests auxiliar enfermeria madrid',
    'tests tcae sermas 2025',
    'tests oposiciones sermas',
    'preguntas tcae sermas madrid',
    'examen tcae sermas',
    '31 temas tcae sermas',
    'C2 sermas madrid'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests TCAE Galicia - 31 Temas Oficiales | Vence',
    description: 'Practica con tests de TCAE del SERGAS. 31 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/tcae-galicia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests TCAE Galicia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests TCAE Galicia | Vence',
    description: 'Tests de los 31 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/tcae-galicia/test`,
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
