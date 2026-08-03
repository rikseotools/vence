const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Agente de la Hacienda Pública 2026 | 32 Temas Oficiales | Vence',
  description: 'Tests de Agente de la Hacienda Pública con los 32 temas oficiales del BOE. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo C1.',
  keywords: ['agente de hacienda', 'agente hacienda publica', 'agentes de la hacienda publica', 'oposicion agente de hacienda', 'agente tributario aeat', 'cuerpo general administrativo hacienda'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Agente de la Hacienda Pública - 32 Temas Oficiales | Vence',
    description: 'Practica con tests de Agente de la Hacienda Pública. 32 temas oficiales en 2 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/agente-hacienda/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Agente de la Hacienda Pública',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Agente de la Hacienda Pública | Vence',
    description: 'Tests de los 32 temas oficiales del BOE. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/agente-hacienda/test`,
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
