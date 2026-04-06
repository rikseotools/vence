const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Oposiciones C1 y C2 en España 2026 | Vence',
  description: 'Directorio de oposiciones de Auxiliar Administrativo (C2) y Administrativo (C1). Estado, CCAA y Ayuntamientos. Plazas, fechas y temarios actualizados.',
  keywords: [
    'oposiciones 2026',
    'auxiliar administrativo',
    'administrativo estado',
    'oposiciones c1 c2',
    'convocatorias españa',
    'plazas oposiciones',
    'temarios oposiciones',
    'tests oposiciones',
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Oposiciones C1 y C2 en España 2026 | Vence',
    description: 'Directorio de oposiciones con plazas, fechas y temarios actualizados.',
    url: `${SITE_URL}/oposiciones`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Oposiciones' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oposiciones C1 y C2 en España 2026 | Vence',
    description: 'Directorio con plazas, fechas y temarios actualizados.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: { canonical: `${SITE_URL}/oposiciones` },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

export default function OposicionesLayout({ children }) {
  return children
}
