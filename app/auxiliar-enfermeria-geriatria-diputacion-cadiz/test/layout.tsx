const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Auxiliar de Enfermería Geriatría de la Diputación de Cádiz 2026 | 25 Temas Oficiales | Vence',
  description: 'Tests de Auxiliar de Enfermería Geriatría de la Diputación de Cádiz con los 25 temas oficiales del BOP. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo C2.',
  keywords: ['auxiliar de enfermeria geriatria diputacion cadiz', 'tcae diputacion cadiz', 'auxiliar enfermeria diputacion de cadiz', 'auxiliar de enfermeria geriatria cadiz', 'tcae geriatria cadiz', 'oposicion auxiliar enfermeria geriatria cadiz'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Auxiliar de Enfermería Geriatría de la Diputación de Cádiz - 25 Temas Oficiales | Vence',
    description: 'Practica con tests de Auxiliar de Enfermería Geriatría de la Diputación de Cádiz. 25 temas oficiales en 2 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/auxiliar-enfermeria-geriatria-diputacion-cadiz/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Auxiliar de Enfermería Geriatría de la Diputación de Cádiz',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Auxiliar de Enfermería Geriatría de la Diputación de Cádiz | Vence',
    description: 'Tests de los 25 temas oficiales del BOP. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-enfermeria-geriatria-diputacion-cadiz/test`,
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
