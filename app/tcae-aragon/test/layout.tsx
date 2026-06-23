const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests TCAE Aragón 2025 | 30 Temas Oficiales | Vence',
  description: 'Tests de TCAE (Auxiliar de Enfermeria) del Servicio Aragonés de Salud con los 30 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test tcae aragon',
    'tests auxiliar enfermeria aragon',
    'tests tcae aragon 2025',
    'tests oposiciones tcae aragon',
    'preguntas tcae aragon',
    'examen tcae aragon',
    '30 temas tcae aragon',
    'C2 servicio aragones salud'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests TCAE Aragón - 30 Temas Oficiales | Vence',
    description: 'Practica con tests de TCAE del Servicio Aragonés de Salud. 30 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/tcae-aragon/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests TCAE Aragón',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests TCAE Aragón | Vence',
    description: 'Tests de los 30 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/tcae-aragon/test`,
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
