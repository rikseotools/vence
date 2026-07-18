const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Administrativo de la Comunidad Autónoma de Aragón 2026 | 35 Temas Oficiales | Vence',
  description: 'Tests de Administrativo de la Comunidad Autónoma de Aragón con los 35 temas oficiales del BOA. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo C1.',
  keywords: ['administrativo dga', 'administrativo gobierno de aragon', 'cuerpo ejecutivo escala general administrativa aragon', 'administrativo aragon c1'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Administrativo de la Comunidad Autónoma de Aragón - 35 Temas Oficiales | Vence',
    description: 'Practica con tests de Administrativo de la Comunidad Autónoma de Aragón. 35 temas oficiales en 2 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/administrativo-aragon/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Administrativo de la Comunidad Autónoma de Aragón',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Administrativo de la Comunidad Autónoma de Aragón | Vence',
    description: 'Tests de los 35 temas oficiales del BOA. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-aragon/test`,
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
