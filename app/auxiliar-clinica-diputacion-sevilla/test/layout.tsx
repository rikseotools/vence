const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar de Clínica de la Diputación Provincial de Sevilla 2026 | 20 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar de Clínica de la Diputación Provincial de Sevilla con los 20 temas oficiales del BOP. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo C2.',
  keywords: ['auxiliar de clinica diputacion sevilla', 'auxiliar clinica diputacion de sevilla', 'tcae diputacion sevilla', 'auxiliar de enfermeria diputacion sevilla', 'auxiliar clinica sevilla', 'oposicion auxiliar de clinica sevilla'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar de Clínica de la Diputación Provincial de Sevilla - 20 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar de Clínica de la Diputación Provincial de Sevilla. 20 temas oficiales en 2 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-clinica-diputacion-sevilla/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar de Clínica de la Diputación Provincial de Sevilla',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar de Clínica de la Diputación Provincial de Sevilla | Vence',
    description: 'Tests de los 20 temas oficiales del BOP. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-clinica-diputacion-sevilla/test`,
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
