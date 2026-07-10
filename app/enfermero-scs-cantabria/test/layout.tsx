const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Enfermero/a del SCS Cantabria 2025 | 65 Temas Oficiales | Vence',
  description: 'Tests de Enfermero/a del Servicio Cántabro de Salud (SCS) con los 65 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo A2.',
  keywords: [
    'test enfermero scs',
    'tests enfermero cantabria',
    'tests temas enfermero servicio cantabro de salud',
    'test enfermero scs 2025',
    'tests oposiciones enfermeria cantabria',
    'preguntas enfermero scs',
    'examen enfermero cantabria',
    '65 temas enfermero scs',
    'A2 enfermeria cantabria'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Enfermero/a del SCS (Cantabria) - 65 Temas Oficiales | Vence',
    description: 'Practica con tests de Enfermero/a del Servicio Cántabro de Salud (SCS). 65 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/enfermero-scs-cantabria/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Tests Enfermero/a del SCS Cantabria' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Enfermero/a del SCS Cantabria | Vence',
    description: 'Tests de los 65 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: { canonical: `${SITE_URL}/enfermero-scs-cantabria/test` },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
