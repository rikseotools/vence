const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos 2026 | 48 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos con los 48 temas oficiales del BOE. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo C2.',
  keywords: [
    'test auxiliar de museos (estado)',
    'tests administrativo ule',
    'tests temas administrativo ule',
    'test administrativo ule 2026',
    'tests oposiciones auxiliar de museos (estado)',
    'preguntas administrativo ule',
    'examen auxiliar de museos (estado)',
    '48 temas administrativo ule c1',
    'C1 auxiliar de museos (estado)'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos - 48 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos. 48 temas oficiales en 4 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-museos-estado/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos | Vence',
    description: 'Tests de los 48 temas oficiales del BOE. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-museos-estado/test`,
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
