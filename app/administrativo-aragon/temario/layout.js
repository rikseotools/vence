const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Administrativo de la Comunidad Autónoma de Aragón 2026 | Vence',
  description: 'Temario completo del Administrativo de la Comunidad Autónoma de Aragón actualizado 2026. 35 temas oficiales organizados en 2 partes.',
  keywords: ['administrativo dga', 'administrativo gobierno de aragon', 'cuerpo ejecutivo escala general administrativa aragon', 'administrativo aragon c1'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Administrativo de la Comunidad Autónoma de Aragón 2026 | Vence',
    description: 'Accede al temario completo del Administrativo de la Comunidad Autónoma de Aragón. 35 temas oficiales organizados en 2 partes.',
    url: `${SITE_URL}/administrativo-aragon/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Administrativo de la Comunidad Autónoma de Aragón',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Administrativo de la Comunidad Autónoma de Aragón | Vence',
    description: 'Temario completo y actualizado 2026. 35 temas oficiales del Administrativo de la Comunidad Autónoma de Aragón.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-aragon/temario`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function TemarioLayout({ children }) {
  return children
}
