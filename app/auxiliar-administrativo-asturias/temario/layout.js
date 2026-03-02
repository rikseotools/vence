const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Principado de Asturias | Vence',
  description: 'Temario completo de Auxiliar Administrativo Principado de Asturias. 25 temas oficiales organizados en 3 bloques con teoria.',
  keywords: [
    'temario auxiliar administrativo asturias',
    'temario auxiliar principado asturias',
    'temario oficial auxiliar asturias',
    'temario oposiciones asturias',
    'temas auxiliar administrativo asturias',
    'teoria auxiliar asturias',
    'temario gratis auxiliar asturias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Principado de Asturias | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo Principado de Asturias. 25 temas oficiales con teoria completa.',
    url: `${SITE_URL}/auxiliar-administrativo-asturias/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Auxiliar Administrativo Asturias' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Principado de Asturias | Vence',
    description: 'Temario completo y actualizado. 25 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-asturias/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
