const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas) 2026 | Vence',
  description: 'Temario completo del Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas) actualizado 2026. 48 temas oficiales organizados en 4 partes.',
  keywords: [
    'temario auxiliar de biblioteca (estado)',
    'temario auxiliar de biblioteca (estado) 2026',
    'temario oficial administrativo ule',
    'oposiciones auxiliar de biblioteca (estado)',
    'temario auxiliar de archivos, bibliotecas y museos del estado (sección bibliotecas)',
    'temas auxiliar de biblioteca (estado)',
    'temario gratis auxiliar de biblioteca (estado)',
    'plazas auxiliar de biblioteca (estado)'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas) 2026 | Vence',
    description: 'Accede al temario completo del Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas). 48 temas oficiales organizados en 4 partes.',
    url: `${SITE_URL}/auxiliar-biblioteca-estado/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas) | Vence',
    description: 'Temario completo y actualizado 2026. 48 temas oficiales del Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas).',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-biblioteca-estado/temario`,
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
