const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Enfermero/a del SAS Andalucía 2026 | 79 Temas Oficiales | Vence',
  description: 'Tests de Enfermero/a del Servicio Andaluz de Salud (SAS) con los 79 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo A2.',
  keywords: [
    'test enfermero sas',
    'tests enfermero andalucia',
    'tests temas enfermero servicio andaluz de salud',
    'test enfermero sas 2026',
    'tests oposiciones enfermeria andalucia',
    'preguntas enfermero sas',
    'examen enfermero andalucia',
    '79 temas enfermero sas',
    'A2 enfermeria andalucia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Enfermero/a del SAS (Andalucía) - 79 Temas Oficiales | Vence',
    description: 'Practica con tests de Enfermero/a del Servicio Andaluz de Salud (SAS). 79 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/enfermero-sas-andalucia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Enfermero/a del SAS Andalucía',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Enfermero/a del SAS Andalucía | Vence',
    description: 'Tests de los 79 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/enfermero-sas-andalucia/test`,
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
