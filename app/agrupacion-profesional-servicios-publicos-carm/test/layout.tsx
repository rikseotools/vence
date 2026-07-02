const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Cuerpo Agrup. Prof. Servicios Públicos CARM 2026 | 12 temas Oficiales | Vence',
  description: 'Tests de Cuerpo Agrup. Prof. Servicios Públicos CARM con los 12 temas oficiales del BORM. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo AP.',
  keywords: [
    'test administrativo murcia',
    'tests administrativo murcia',
    'tests temas agrupacion profesional servicios publicos murcia',
    'test administrativo murcia 2026',
    'tests oposiciones murcia',
    'preguntas administrativo murcia',
    'examen administrativo murcia',
    '12 temas agrupacion profesional servicios publicos murcia',
    'C1 gobierno de murcia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Cuerpo Agrup. Prof. Servicios Públicos CARM - 12 temas Oficiales | Vence',
    description: 'Practica con tests de Cuerpo Agrup. Prof. Servicios Públicos CARM. 12 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/agrupacion-profesional-servicios-publicos-carm/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Cuerpo Agrup. Prof. Servicios Públicos CARM',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Cuerpo Agrup. Prof. Servicios Públicos CARM | Vence',
    description: 'Tests de los 12 temas oficiales del BORM. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/agrupacion-profesional-servicios-publicos-carm/test`,
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
