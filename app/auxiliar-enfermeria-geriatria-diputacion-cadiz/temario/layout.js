const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Auxiliar de Enfermería Geriatría de la Diputación de Cádiz 2026 | Vence',
  description: 'Temario completo del Auxiliar de Enfermería Geriatría de la Diputación de Cádiz actualizado 2026. 25 temas oficiales organizados en 2 partes.',
  keywords: ['auxiliar de enfermeria geriatria diputacion cadiz', 'tcae diputacion cadiz', 'auxiliar enfermeria diputacion de cadiz', 'auxiliar de enfermeria geriatria cadiz', 'tcae geriatria cadiz', 'oposicion auxiliar enfermeria geriatria cadiz'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Auxiliar de Enfermería Geriatría de la Diputación de Cádiz 2026 | Vence',
    description: 'Accede al temario completo del Auxiliar de Enfermería Geriatría de la Diputación de Cádiz. 25 temas oficiales organizados en 2 partes.',
    url: `${SITE_URL}/auxiliar-enfermeria-geriatria-diputacion-cadiz/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Auxiliar de Enfermería Geriatría de la Diputación de Cádiz',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Auxiliar de Enfermería Geriatría de la Diputación de Cádiz | Vence',
    description: 'Temario completo y actualizado 2026. 25 temas oficiales del Auxiliar de Enfermería Geriatría de la Diputación de Cádiz.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-enfermeria-geriatria-diputacion-cadiz/temario`,
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

export default function TemarioLayout({ children }) {
  return children
}
