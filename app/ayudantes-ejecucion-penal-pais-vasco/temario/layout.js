const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Ayudantes en Ejecución Penal Euskadi 2026 | Vence',
  description: 'Temario completo del Escala de Ayudantes en Ejecución Penal de Euskadi actualizado 2026. 53 temas oficiales en 2 partes (general y específica).',
  keywords: [
    'temario ayudantes ejecucion penal euskadi',
    'temario ayudantes ejecucion penal euskadi 2026',
    'temario oficial administrativo ule',
    'oposiciones ayudantes ejecucion penal euskadi',
    'temario ayudantes ejecucion penal euskadi',
    'temas ayudantes ejecucion penal euskadi',
    'temario gratis ayudantes ejecucion penal euskadi',
    '11 plazas ayudantes ejecucion penal euskadi'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Ayudantes en Ejecución Penal Euskadi 2026 | Vence',
    description: 'Accede al temario completo del Escala de Ayudantes en Ejecución Penal de Euskadi. 53 temas oficiales en 2 partes (general y específica).',
    url: `${SITE_URL}/ayudantes-ejecucion-penal-pais-vasco/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Ayudantes en Ejecución Penal Euskadi',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Ayudantes en Ejecución Penal Euskadi | Vence',
    description: 'Temario completo y actualizado 2026. 53 temas oficiales del Ayudantes en Ejecución Penal.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/ayudantes-ejecucion-penal-pais-vasco/temario`,
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
