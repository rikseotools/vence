const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Principado de Asturias | Vence',
  description: 'Temario completo de Administrativo Principado de Asturias. 38 temas oficiales organizados en 5 partes con teoria.',
  keywords: [
    'temario administrativo asturias',
    'temario administrativo principado de asturias',
    'temario oficial administrativo asturias',
    'temario oposiciones asturias',
    'temas administrativo asturias',
    'teoria administrativo asturias',
    'temario gratis administrativo asturias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Principado de Asturias | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Administrativo Principado de Asturias. 38 temas oficiales con teoria completa.',
    url: `${SITE_URL}/administrativo-asturias/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Administrativo Principado de Asturias' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Principado de Asturias | Vence',
    description: 'Temario completo y actualizado. 38 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-asturias/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
