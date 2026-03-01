const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Xunta de Galicia | Vence',
  description: 'Temario completo de Auxiliar Administrativo Xunta de Galicia. 17 temas oficiales organizados en 2 partes con teoria.',
  keywords: [
    'temario auxiliar administrativo galicia',
    'temario auxiliar xunta de galicia',
    'temario oficial auxiliar galicia',
    'temario oposiciones galicia',
    'temas auxiliar administrativo galicia',
    'teoria auxiliar galicia',
    'temario gratis auxiliar galicia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Xunta de Galicia | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo Xunta de Galicia. 17 temas oficiales con teoria completa.',
    url: `${SITE_URL}/auxiliar-administrativo-galicia/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Auxiliar Administrativo Xunta de Galicia' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Xunta de Galicia | Vence',
    description: 'Temario completo y actualizado. 17 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-galicia/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
