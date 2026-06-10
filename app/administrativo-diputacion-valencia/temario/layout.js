const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Diputación de Valencia C1-01 | Vence',
  description: 'Temario completo de Administrativo Diputación de Valencia C1-01. 40 temas oficiales organizados en 2 bloques con teoria.',
  keywords: [
    'temario auxiliar administrativo valencia',
    'temario auxiliar Diputación de Valencia',
    'temario oficial auxiliar valencia',
    'temario oposiciones valencia',
    'temas auxiliar administrativo valencia',
    'teoria auxiliar valencia',
    'temario gratis auxiliar valencia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Diputación de Valencia C1-01 | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Administrativo Diputación de Valencia C1-01. 40 temas oficiales con teoria completa.',
    url: `${SITE_URL}/administrativo-diputacion-valencia/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Administrativo Diputación de Valencia C1-01' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Diputación de Valencia C1-01 | Vence',
    description: 'Temario completo y actualizado. 40 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-diputacion-valencia/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
