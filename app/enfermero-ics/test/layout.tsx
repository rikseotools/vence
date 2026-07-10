const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
export const metadata = {
  title: 'Tests Enfermero/a del ICS Cataluña 2026 | 19 Temas Oficiales | Vence',
  description: 'Tests de Enfermero/a del Institut Català de la Salut (ICS) con los 19 temas oficiales. 1.371 plazas turno libre. Preguntas personalizables y estadísticas por tema. Grupo A2.',
  keywords: ['test enfermero ics','tests enfermero cataluña','test enfermero ics 2026','tests oposicions infermeria ics','preguntas enfermero ics','examen enfermero cataluña','19 temas enfermero ics','A2 enfermeria cataluña'].join(', '),
  authors: [{ name: 'Vence' }], creator: 'Vence', publisher: 'Vence', metadataBase: new URL(SITE_URL),
  openGraph: { title: 'Tests Enfermero/a del ICS (Cataluña) - 19 Temas Oficiales | Vence', description: 'Practica con tests de Enfermero/a del ICS. 19 temas oficiales.', url: `${SITE_URL}/enfermero-ics/test`, siteName: 'Vence', locale: 'es_ES', type: 'website', images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Tests Enfermero/a del ICS' }] },
  twitter: { card: 'summary_large_image', title: 'Tests Enfermero/a del ICS Cataluña | Vence', description: 'Tests de los 19 temas oficiales.', images: ['/twitter-image-es.jpg'] },
  alternates: { canonical: `${SITE_URL}/enfermero-ics/test` },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}
export default function TestLayout({ children }: { children: React.ReactNode }) { return children }
