const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Castilla y León 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo Castilla y León actualizado 2026. 28 temas oficiales organizados en 2 grupos con teoría.',
  keywords: [
    'temario auxiliar administrativo castilla y leon',
    'temario auxiliar cyl 2026',
    'temario oficial auxiliar cyl',
    'temario oposiciones castilla y leon',
    'temas auxiliar administrativo cyl',
    'teoría auxiliar castilla y leon',
    'temario gratis auxiliar cyl'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Castilla y León 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo Castilla y León. 28 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-cyl/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo Castilla y León',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Castilla y León | Vence',
    description: 'Temario completo y actualizado 2026. 28 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-cyl/temario`,
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
