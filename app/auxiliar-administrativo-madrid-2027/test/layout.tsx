const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar Administrativo Comunidad de Madrid 2027 (examen junio 2027) | 21 Temas Oficiales | Vence',
  description: 'Tests de la convocatoria 2026 (Orden 1628, examen junio 2027) del Auxiliar Administrativo Comunidad de Madrid con los 21 temas oficiales. Ofimática Windows 11. Preguntas personalizables y estadísticas por tema. Grupo C2.',
  keywords: [
    'test auxiliar administrativo madrid 2027',
    'tests auxiliar madrid junio 2027',
    'tests temas auxiliar madrid orden 1628',
    'test auxiliar administrativo madrid windows 11',
    'tests oposiciones comunidad de madrid 2027',
    'preguntas auxiliar administrativo madrid 2027',
    'examen auxiliar comunidad de madrid junio 2027',
    '21 temas auxiliar madrid 2027',
    'C2 comunidad de madrid 2027'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar Administrativo Comunidad de Madrid 2027 - 21 Temas Oficiales | Vence',
    description: 'Practica con tests de la convocatoria examen junio 2027 del Auxiliar Administrativo Comunidad de Madrid. 21 temas oficiales en 2 bloques, ofimática Windows 11.',
    url: `${SITE_URL}/auxiliar-administrativo-madrid-2027/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar Administrativo Comunidad de Madrid (examen junio 2027)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar Administrativo Comunidad de Madrid 2027 | Vence',
    description: 'Tests de los 21 temas oficiales (examen junio 2027). Ofimática Windows 11, estadísticas por tema.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-madrid-2027/test`,
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
