const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests TCAE Osakidetza 2026 | 49 Temas Oficiales | Vence',
  description: 'Tests de TCAE (Auxiliar de Enfermeria) de Osakidetza con los 49 temas oficiales. Preguntas de examenes reales, estadisticas por tema y seguimiento de progreso.',
  keywords: [
    'test tcae osakidetza',
    'tests auxiliar enfermeria pais vasco',
    'tests tcae osakidetza 2026',
    'tests oposiciones osakidetza',
    'preguntas tcae osakidetza',
    'examen tcae osakidetza',
    'osakidetza auxiliar enfermeria'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests TCAE Osakidetza - 49 Temas Oficiales | Vence',
    description: 'Practica con tests de TCAE de Osakidetza. 49 temas oficiales, preguntas de examenes reales.',
    url: `${SITE_URL}/auxiliar-enfermeria-osakidetza/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Tests TCAE Osakidetza' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests TCAE Osakidetza | Vence',
    description: 'Tests de los 49 temas oficiales. Preguntas de examenes reales.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: { canonical: `${SITE_URL}/auxiliar-enfermeria-osakidetza/test` },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
