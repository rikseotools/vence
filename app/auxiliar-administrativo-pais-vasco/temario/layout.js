const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Gobierno Vasco | Vence',
  description: 'Temario completo de Auxiliar Administrativo del Gobierno Vasco. 13 temas oficiales organizados en 1 bloque con teoria.',
  keywords: [
    'temario auxiliar administrativo pais-vasco',
    'temario auxiliar gobierno pais-vasco',
    'temario oficial auxiliar pais-vasco',
    'temario oposiciones pais-vasco',
    'temas auxiliar administrativo pais-vasco',
    'teoria auxiliar pais-vasco',
    'temario gratis auxiliar pais-vasco'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Gobierno Vasco | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo del Gobierno Vasco. 13 temas oficiales con teoria completa.',
    url: `${SITE_URL}/auxiliar-administrativo-pais-vasco/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Auxiliar Administrativo País Vasco' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Gobierno Vasco | Vence',
    description: 'Temario completo y actualizado. 13 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-pais-vasco/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
