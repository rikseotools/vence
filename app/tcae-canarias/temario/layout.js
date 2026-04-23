const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario TCAE Canarias 2025 | 24 Temas Oficiales | Vence',
  description: 'Temario oficial de TCAE (Auxiliar de Enfermeria) del Canarias. 24 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: [
    'temario tcae sermas',
    'temario auxiliar enfermeria madrid',
    'temario tcae sermas 2025',
    'temario oficial tcae madrid',
    'temas tcae sermas',
    'teoria tcae servicio canario salud',
    'temario gratis tcae sermas'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario TCAE Canarias - 24 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de TCAE del Servicio Canario de Salud. 24 temas oficiales segun BOCM 31/07/2025.',
    url: `${SITE_URL}/tcae-canarias/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario TCAE Canarias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario TCAE Canarias | Vence',
    description: 'Temario completo y actualizado 2025. 24 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/tcae-canarias/temario`,
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
