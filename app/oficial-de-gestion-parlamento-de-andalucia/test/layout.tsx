const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Oficial de Gestión del Parlamento de Andalucía 2026 | 44 Temas Oficiales | Vence',
  description: 'Tests de Oficial de Gestión del Parlamento de Andalucía con los 44 temas oficiales del BOJA. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo C1.',
  keywords: ['oficial de gestion parlamento de andalucia', 'oficiales de gestion parlamento andalucia', 'oficial gestion parlamento andaluz', 'oposicion oficial de gestion parlamento andalucia'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Oficial de Gestión del Parlamento de Andalucía - 44 Temas Oficiales | Vence',
    description: 'Practica con tests de Oficial de Gestión del Parlamento de Andalucía. 44 temas oficiales en 2 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/oficial-de-gestion-parlamento-de-andalucia/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Oficial de Gestión del Parlamento de Andalucía',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Oficial de Gestión del Parlamento de Andalucía | Vence',
    description: 'Tests de los 44 temas oficiales del BOJA. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/oficial-de-gestion-parlamento-de-andalucia/test`,
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
