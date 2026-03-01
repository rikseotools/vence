const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Generalitat Valenciana | Vence',
  description: 'Temario completo de Auxiliar Administrativo Generalitat Valenciana. 24 temas oficiales organizados en 2 bloques con teoria.',
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
    title: 'Temario Auxiliar Administrativo Generalitat Valenciana | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo Generalitat Valenciana. 24 temas oficiales con teoria completa.',
    url: `${SITE_URL}/auxiliar-administrativo-valencia/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Auxiliar Administrativo Generalitat Valenciana' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Generalitat Valenciana | Vence',
    description: 'Temario completo y actualizado. 24 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-valencia/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
