const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Auxiliar de Clínica de la Diputación Provincial de Sevilla 2026 | Vence',
  description: 'Temario completo del Auxiliar de Clínica de la Diputación Provincial de Sevilla actualizado 2026. 20 temas oficiales organizados en 2 partes.',
  keywords: ['auxiliar de clinica diputacion sevilla', 'auxiliar clinica diputacion de sevilla', 'tcae diputacion sevilla', 'auxiliar de enfermeria diputacion sevilla', 'auxiliar clinica sevilla', 'oposicion auxiliar de clinica sevilla'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Auxiliar de Clínica de la Diputación Provincial de Sevilla 2026 | Vence',
    description: 'Accede al temario completo del Auxiliar de Clínica de la Diputación Provincial de Sevilla. 20 temas oficiales organizados en 2 partes.',
    url: `${SITE_URL}/auxiliar-clinica-diputacion-sevilla/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Auxiliar de Clínica de la Diputación Provincial de Sevilla',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Auxiliar de Clínica de la Diputación Provincial de Sevilla | Vence',
    description: 'Temario completo y actualizado 2026. 20 temas oficiales del Auxiliar de Clínica de la Diputación Provincial de Sevilla.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-clinica-diputacion-sevilla/temario`,
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
