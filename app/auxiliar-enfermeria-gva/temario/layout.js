const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Aux Enfermería GVA 2025 | 24 Temas Oficiales | Vence',
  description: 'Temario oficial de TCAE (Auxiliar de Enfermeria) del GVA. 24 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: [
    'temario auxiliar enfermeria gva',
    'temario auxiliar enfermeria valencia',
    'temario auxiliar enfermeria gva 2025',
    'temario oficial tcae valencia',
    'temas auxiliar enfermeria gva',
    'teoria tcae generalitat valenciana',
    'temario gratis auxiliar enfermeria gva'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Aux Enfermería GVA - 24 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Auxiliar de Enfermería GVA. 24 temas oficiales segun DOGV.',
    url: `${SITE_URL}/auxiliar-enfermeria-gva/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Aux Enfermería GVA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Aux Enfermería GVA | Vence',
    description: 'Temario completo y actualizado 2025. 24 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-enfermeria-gva/temario`,
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
