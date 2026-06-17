const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Gobierno de Cantabria 2026 | Vence',
  description: 'Temario completo de Auxiliar Administrativo de la Gobierno de Cantabria actualizado 2026. 40 temas oficiales con teoría.',
  keywords: [
    'temario auxiliar administrativo gobierno de cantabria',
    'temario auxiliar gobierno de cantabria 2026',
    'temario oficial auxiliar gobierno de cantabria',
    'temario oposiciones gobierno de cantabria',
    'temas auxiliar administrativo gobierno de cantabria',
    'teoría auxiliar gobierno de cantabria',
    'temario gratis auxiliar gobierno de cantabria'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo de la Gobierno de Cantabria 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo de la Gobierno de Cantabria. 40 temas oficiales con teoría completa.',
    url: `${SITE_URL}/administrativo-cantabria/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo de la Gobierno de Cantabria',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo de la Gobierno de Cantabria | Vence',
    description: 'Temario completo y actualizado 2026. 40 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-cantabria/temario`,
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
