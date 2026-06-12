const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Gobierno Vasco | Vence',
  description: 'Temario completo de Administrativo del Gobierno Vasco. 34 temas oficiales organizados en 1 bloque con teoria.',
  keywords: [
    'temario administrativo pais-vasco',
    'temario administrativo gobierno pais-vasco',
    'temario oficial administrativo pais-vasco',
    'temario oposiciones pais-vasco',
    'temas administrativo pais-vasco',
    'teoria administrativo pais-vasco',
    'temario gratis administrativo pais-vasco'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Gobierno Vasco | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Administrativo del Gobierno Vasco. 34 temas oficiales con teoria completa.',
    url: `${SITE_URL}/administrativo-pais-vasco/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Administrativo País Vasco' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Gobierno Vasco | Vence',
    description: 'Temario completo y actualizado. 34 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-pais-vasco/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
