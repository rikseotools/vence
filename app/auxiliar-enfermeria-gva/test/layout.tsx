const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Aux Enfermería GVA 2025 | 24 Temas Oficiales | Vence',
  description: 'Tests de TCAE (Auxiliar de Enfermeria) del GVA con los 24 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test auxiliar enfermeria gva',
    'tests auxiliar enfermeria valencia',
    'tests auxiliar enfermeria gva 2025',
    'tests oposiciones gva',
    'preguntas auxiliar enfermeria gva valencia',
    'examen auxiliar enfermeria gva',
    '24 temas auxiliar enfermeria gva',
    'C2 generalitat valenciana'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Aux Enfermería GVA - 24 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar de Enfermería GVA. 24 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-enfermeria-gva/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Aux Enfermería GVA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Aux Enfermería GVA | Vence',
    description: 'Tests de los 24 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-enfermeria-gva/test`,
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
