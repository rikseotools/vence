const SITE_URL = process.env.SITE_URL || 'https://www.ilovetest.pro'

export const metadata = {
  title: 'Oposiciones Disponibles 2025 | Preparación Online | Vence',
  description: 'Elige tu oposición y prepárate con nuestro sistema completo. Auxiliar Administrativo del Estado, temarios actualizados, tests ilimitados y seguimiento personalizado.',
  keywords: [
    'oposiciones 2025',
    'preparar oposiciones online',
    'auxiliar administrativo estado',
    'oposiciones administración pública',
    'temarios oposiciones',
    'tests oposiciones gratis',
    'preparación oposiciones',
    'sistema estudio oposiciones'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Oposiciones Disponibles 2025 | Preparación Completa',
    description: 'Sistema completo de preparación para oposiciones. Temarios actualizados, tests personalizados y seguimiento detallado.',
    url: `${SITE_URL}/es/oposiciones`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Oposiciones Disponibles',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oposiciones Disponibles 2025 | Vence',
    description: 'Sistema completo de preparación para oposiciones con temarios y tests actualizados.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/es/oposiciones`,
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

export default function OposicionesLayout({ children }) {
  return children
}