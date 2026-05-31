const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Generalitat de Catalunya | Vence',
  description: 'Temario completo de Auxiliar Administrativo del Generalitat de Catalunya. 15 temas oficiales organizados en 1 bloque con teoria.',
  keywords: [
    'temario auxiliar administrativo catalunya',
    'temario auxiliar gobierno catalunya',
    'temario oficial auxiliar catalunya',
    'temario oposiciones catalunya',
    'temas auxiliar administrativo catalunya',
    'teoria auxiliar catalunya',
    'temario gratis auxiliar catalunya'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Generalitat de Catalunya | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo del Generalitat de Catalunya. 15 temas oficiales con teoria completa.',
    url: `${SITE_URL}/auxiliar-administrativo-catalunya/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Auxiliar Administrativo Catalunya' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Generalitat de Catalunya | Vence',
    description: 'Temario completo y actualizado. 15 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-catalunya/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
