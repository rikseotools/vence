const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo DGA Aragon | Vence',
  description: 'Temario completo de Auxiliar Administrativo de Aragon (DGA). 20 temas oficiales organizados en 2 bloques con teoria.',
  keywords: [
    'temario auxiliar administrativo aragon',
    'temario auxiliar dga aragon',
    'temario oficial auxiliar aragon',
    'temario oposiciones aragon',
    'temas auxiliar administrativo aragon',
    'teoria auxiliar aragon',
    'temario gratis auxiliar aragon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo DGA Aragon | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de Aragon (DGA). 20 temas oficiales con teoria completa.',
    url: `${SITE_URL}/auxiliar-administrativo-aragon/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Auxiliar Administrativo Aragon' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo DGA Aragon | Vence',
    description: 'Temario completo y actualizado. 20 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-aragon/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
