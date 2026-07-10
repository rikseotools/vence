const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Enfermero/a del SMS Murcia 2025 | 71 Temas Oficiales | Vence',
  description: 'Tests de Enfermero/a del Servicio Murciano de Salud (SMS) con los 71 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo A2.',
  keywords: [
    'test enfermero sms',
    'tests enfermero murcia',
    'tests temas enfermero servicio murciano de salud',
    'test enfermero sms 2025',
    'tests oposiciones enfermeria murcia',
    'preguntas enfermero sms',
    'examen enfermero murcia',
    '71 temas enfermero sms',
    'A2 enfermeria murcia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Enfermero/a del SMS (Murcia) - 71 Temas Oficiales | Vence',
    description: 'Practica con tests de Enfermero/a del Servicio Murciano de Salud (SMS). 71 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/enfermero-sms/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Tests Enfermero/a del SMS Murcia' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Enfermero/a del SMS Murcia | Vence',
    description: 'Tests de los 71 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: { canonical: `${SITE_URL}/enfermero-sms/test` },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
