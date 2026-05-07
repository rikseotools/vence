const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Generalitat Valenciana C1-01 | Vence',
  description: 'Temario completo de Administrativo Generalitat Valenciana C1-01. 35 temas oficiales organizados en 2 bloques con teoria.',
  keywords: [
    'temario auxiliar administrativo valencia',
    'temario auxiliar generalitat valenciana',
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
    title: 'Temario Administrativo Generalitat Valenciana C1-01 | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Administrativo Generalitat Valenciana C1-01. 35 temas oficiales con teoria completa.',
    url: `${SITE_URL}/administrativo-gva/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Administrativo Generalitat Valenciana C1-01' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Generalitat Valenciana C1-01 | Vence',
    description: 'Temario completo y actualizado. 35 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-gva/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
