const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Ayudante de Instituciones Penitenciarias 2026 | Vence',
  description: 'Temario completo de Ayudante de Instituciones Penitenciarias actualizado 2026. 50 temas oficiales organizados en 4 bloques con teoría y PDFs descargables.',
  keywords: [
    'temario ayudante de instituciones penitenciarias',
    'temario ayudante de instituciones penitenciarias 2026',
    'temario oficial ayudante de instituciones penitenciarias',
    'temario administracion justicia',
    'temario oposiciones ayudante de instituciones penitenciarias',
    'pdf temario ayudante de instituciones penitenciarias',
    'temas ayudante de instituciones penitenciarias',
    'teoría ayudante de instituciones penitenciarias',
    'temario gratis ayudante de instituciones penitenciarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Ayudante de Instituciones Penitenciarias 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Ayudante de Instituciones Penitenciarias. 50 temas oficiales con teoría completa.',
    url: `${SITE_URL}/ayudante-instituciones-penitenciarias/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Ayudante de Instituciones Penitenciarias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Ayudante de Instituciones Penitenciarias | Vence',
    description: 'Temario completo y actualizado 2026. 50 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/ayudante-instituciones-penitenciarias/temario`,
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
