const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Enfermero SCS Canarias 2025 | 50 Temas Oficiales | Vence',
  description: 'Temario oficial de Enfermero/a del Servicio Canario de la Salud. 50 temas de cuidados de enfermería, metodología y clínica.',
  keywords: [
    'temario enfermero scs',
    'temario enfermero canarias',
    'temario enfermero scs 2025',
    'temario oficial enfermero canarias',
    'temas enfermero scs',
    'teoria enfermero servicio canario salud',
    'temario gratis enfermero canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Enfermero SCS Canarias - 50 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Enfermero/a del Servicio Canario de la Salud. 50 temas oficiales segun BOC.',
    url: `${SITE_URL}/enfermero-scs-canarias/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Enfermero SCS Canarias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Enfermero SCS Canarias | Vence',
    description: 'Temario completo y actualizado 2025. 50 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/enfermero-scs-canarias/temario`,
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
