const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Enfermero/a del SACYL Castilla y León 2026 | 54 Temas Oficiales | Vence',
  description: 'Tests de Enfermero/a del Servicio de Salud de Castilla y León (SACYL) con los 54 temas oficiales. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Grupo A2.',
  keywords: ['test enfermero sacyl','tests enfermero castilla y leon','test enfermero sacyl 2026','tests oposiciones enfermeria cyl','preguntas enfermero sacyl','examen enfermero castilla y leon','54 temas enfermero sacyl','A2 enfermeria castilla y leon'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Enfermero/a del SACYL (Castilla y León) - 54 Temas Oficiales | Vence',
    description: 'Practica con tests de Enfermero/a del SACYL. 54 temas oficiales, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/enfermero-sacyl/test`,
    siteName: 'Vence', locale: 'es_ES', type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Tests Enfermero/a del SACYL' }],
  },
  twitter: { card: 'summary_large_image', title: 'Tests Enfermero/a del SACYL | Vence', description: 'Tests de los 54 temas oficiales.', images: ['/twitter-image-es.jpg'] },
  alternates: { canonical: `${SITE_URL}/enfermero-sacyl/test` },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
