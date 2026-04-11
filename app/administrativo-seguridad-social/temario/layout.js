const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Seguridad Social | Vence',
  description: 'Temario completo del Cuerpo Administrativo de la Administración de la Seguridad Social. 36 temas oficiales organizados en 2 bloques (general y específico) con teoría.',
  keywords: [
    'temario administrativo seguridad social',
    'temario oficial administrativo seguridad social',
    'temario oposiciones seguridad social',
    'temas administrativo seguridad social',
    'BOE administrativo seguridad social',
    'C1 seguridad social',
    'temario gratis administrativo seguridad social'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Seguridad Social | Teoría Oficial',
    description: 'Accede al temario completo y actualizado del Cuerpo Administrativo de la Seguridad Social. 36 temas oficiales con teoría completa.',
    url: `${SITE_URL}/administrativo-seguridad-social/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Administrativo Seguridad Social' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Seguridad Social | Vence',
    description: 'Temario completo y actualizado. 36 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-seguridad-social/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
