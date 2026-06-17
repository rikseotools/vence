const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Junta de Andalucía 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Junta de Andalucía actualizado 2026. 42 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo junta de andalucía',
    'temario auxiliar junta de andalucía 2026',
    'temario oficial auxiliar junta de andalucía',
    'temario oposiciones junta de andalucía',
    'temas auxiliar administrativo junta de andalucía',
    'teoría auxiliar junta de andalucía',
    'temario gratis auxiliar junta de andalucía'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Junta de Andalucía 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Junta de Andalucía. 42 temas oficiales con teoría completa.',
    url: `${SITE_URL}/administrativo-andalucia/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Junta de Andalucía',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Junta de Andalucía | Vence',
    description: 'Temario completo y actualizado 2026. 42 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-andalucia/temario`,
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
