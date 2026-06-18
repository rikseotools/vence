const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Cuerpo Auxiliar Administrativo Valladolid 2026 | 27 temas Oficiales | Vence',
  description: 'Tests de Cuerpo Auxiliar Administrativo Valladolid con los 27 temas oficiales del DOCM. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test auxiliar administrativo valladolid',
    'tests auxiliar administrativo valladolid',
    'tests temas auxiliar administrativo valladolid',
    'test auxiliar administrativo valladolid 2026',
    'tests oposiciones valladolid',
    'preguntas auxiliar administrativo valladolid',
    'examen auxiliar administrativo valladolid',
    '27 temas auxiliar administrativo valladolid  c2',
    'C2 ayuntamiento de valladolid'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Cuerpo Auxiliar Administrativo Valladolid - 27 temas Oficiales | Vence',
    description: 'Practica con tests de Cuerpo Auxiliar Administrativo Valladolid. 27 temas oficiales en 6 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-valladolid/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Cuerpo Auxiliar Administrativo Valladolid',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Cuerpo Auxiliar Administrativo Valladolid | Vence',
    description: 'Tests de los 27 temas oficiales del DOCM. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-valladolid/test`,
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
