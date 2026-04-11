const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo Seguridad Social | 36 Temas Oficiales | Vence',
  description: 'Tests del Cuerpo Administrativo de la Administración de la Seguridad Social con los 36 temas oficiales (BOE-A-2025-27158). Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C1.',
  keywords: [
    'test administrativo seguridad social',
    'tests administrativo seguridad social',
    'tests temas administrativo seguridad social',
    'test oposiciones seguridad social',
    'preguntas administrativo seguridad social',
    'examen administrativo seguridad social',
    '36 temas administrativo seguridad social',
    'C1 seguridad social',
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo Seguridad Social - 36 Temas Oficiales | Vence',
    description: 'Practica con tests del Administrativo de la Seguridad Social. 36 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-seguridad-social/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativo Seguridad Social',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo Seguridad Social | Vence',
    description: 'Tests de los 36 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-seguridad-social/test`,
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
