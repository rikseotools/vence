const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) 2026 | 14 Temas Oficiales | Vence',
  description: 'Tests de Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) con los 14 temas oficiales del BORM. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo E.',
  keywords: ['celador sms murcia', 'celador subalterno murcia', 'celador servicio murciano de salud', 'oposicion celador murcia', 'celadores sms'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) - 14 Temas Oficiales | Vence',
    description: 'Practica con tests de Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS). 14 temas oficiales en 2 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/celador-murcia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) | Vence',
    description: 'Tests de los 14 temas oficiales del BORM. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-murcia/test`,
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
