const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests TCAE SAS 2025 | 29 Temas Oficiales | Vence',
  description: 'Tests de TCAE (Auxiliar de Enfermeria) del Servicio Andaluz de Salud (SAS) con los 29 temas oficiales. Preguntas personalizables, estadisticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test tcae sas',
    'tests auxiliar enfermeria andalucia',
    'tests tcae sas 2025',
    'tests oposiciones sas',
    'preguntas tcae sas andalucia',
    'examen tcae sas',
    '29 temas tcae sas',
    'C2 sas andalucia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests TCAE SAS - 29 Temas Oficiales | Vence',
    description: 'Practica con tests de TCAE del Servicio Andaluz de Salud. 29 temas oficiales en 2 bloques, estadisticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/tcae-sas/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests TCAE SAS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests TCAE SAS | Vence',
    description: 'Tests de los 29 temas oficiales. Estadisticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/tcae-sas/test`,
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
