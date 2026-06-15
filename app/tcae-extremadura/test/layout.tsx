const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests TCAE SES Extremadura 2026 | 30 Temas Oficiales | Vence',
  description: 'Tests de TCAE (Auxiliar de Enfermería) del SES (Extremadura) con los 30 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo C2.',
  keywords: [
    'test tcae ses-extremadura',
    'tests auxiliar enfermeria extremadura',
    'tests tcae ses-extremadura 2026',
    'tests oposiciones ses-extremadura',
    'preguntas tcae ses-extremadura',
    'examen tcae ses-extremadura',
    '30 temas tcae ses-extremadura',
    'C2 ses-extremadura extremadura'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests TCAE SES Extremadura - 30 Temas Oficiales | Vence',
    description: 'Practica con tests de TCAE del Servicio Extremeño de Salud. 30 temas oficiales en 2 bloques, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/tcae-extremadura/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Tests TCAE SES Extremadura' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests TCAE SES Extremadura | Vence',
    description: 'Tests de los 30 temas oficiales. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: { canonical: `${SITE_URL}/tcae-extremadura/test` },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
