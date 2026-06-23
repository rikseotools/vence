const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Celador SAS Andalucía 2025 | 19 Temas Oficiales | Vence',
  description: 'Tests de Celador del Servicio Andaluz de Salud con los 19 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo E.',
  keywords: [
    'test celador sas',
    'tests celador andalucia',
    'tests celador sas 2025',
    'tests oposiciones celador andalucia',
    'preguntas celador sas',
    'examen celador andalucia',
    '19 temas celador sas',
    'grupo E celador andalucia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Celador SAS Andalucía - 19 Temas Oficiales | Vence',
    description: 'Practica con tests de Celador del Servicio Andaluz de Salud. 19 temas oficiales, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/celador-sas/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Celador SAS Andalucía',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Celador SAS Andalucía | Vence',
    description: 'Tests de los 19 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-sas/test`,
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
