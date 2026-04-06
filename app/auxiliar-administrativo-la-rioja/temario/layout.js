const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Gobierno de La Rioja | Vence',
  description: 'Temario completo de Auxiliar Administrativo del Gobierno de La Rioja. 23 temas oficiales organizados en 2 bloques con teoria.',
  keywords: [
    'temario auxiliar administrativo la rioja',
    'temario auxiliar gobierno la rioja',
    'temario oficial auxiliar la rioja',
    'temario oposiciones la rioja',
    'temas auxiliar administrativo la rioja',
    'teoria auxiliar la rioja',
    'temario gratis auxiliar la rioja'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Gobierno de La Rioja | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo del Gobierno de La Rioja. 23 temas oficiales con teoria completa.',
    url: `${SITE_URL}/auxiliar-administrativo-la-rioja/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Auxiliar Administrativo La Rioja' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Gobierno de La Rioja | Vence',
    description: 'Temario completo y actualizado. 23 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-la-rioja/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
