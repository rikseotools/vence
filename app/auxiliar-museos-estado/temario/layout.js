const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos 2026 | Vence',
  description: 'Temario completo del Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos actualizado 2026. 48 temas oficiales organizados en 4 partes.',
  keywords: [
    'temario auxiliar de museos (estado)',
    'temario auxiliar de museos (estado) 2026',
    'temario oficial administrativo ule',
    'oposiciones auxiliar de museos (estado)',
    'temario auxiliar de archivos, bibliotecas y museos del estado — sección museos',
    'temas auxiliar de museos (estado)',
    'temario gratis auxiliar de museos (estado)',
    'plazas auxiliar de museos (estado)'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos 2026 | Vence',
    description: 'Accede al temario completo del Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos. 48 temas oficiales organizados en 4 partes.',
    url: `${SITE_URL}/auxiliar-museos-estado/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos | Vence',
    description: 'Temario completo y actualizado 2026. 48 temas oficiales del Auxiliar de Archivos, Bibliotecas y Museos del Estado — Sección Museos.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-museos-estado/temario`,
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
