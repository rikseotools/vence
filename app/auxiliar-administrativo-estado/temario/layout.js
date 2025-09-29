const SITE_URL = process.env.SITE_URL || 'https://www.ilovetest.pro'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Estado 2025 | iLoveTest',
  description: 'Temario completo de Auxiliar Administrativo del Estado actualizado 2025. 16 temas oficiales con teoría, PDFs descargables y sistema progresivo de desbloqueo.',
  keywords: [
    'temario auxiliar administrativo estado',
    'temario auxiliar administrativo 2025',
    'temario oficial auxiliar administrativo',
    'constitución española temario',
    'temario transparencia 19/2013',
    'temario oposiciones auxiliar administrativo',
    'pdf temario auxiliar administrativo',
    'temas auxiliar administrativo estado',
    'teoría auxiliar administrativo',
    'temario gratis auxiliar administrativo'
  ].join(', '),
  authors: [{ name: 'iLoveTest' }],
  creator: 'iLoveTest',
  publisher: 'iLoveTest',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Estado 2025 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo del Estado. 16 temas oficiales con teoría completa y PDFs.',
    url: `${SITE_URL}/auxiliar-administrativo-estado/temario`,
    siteName: 'iLoveTest',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'iLoveTest - Temario Auxiliar Administrativo Estado',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Estado | iLoveTest',
    description: 'Temario completo y actualizado 2025. 16 temas oficiales con teoría y PDFs descargables.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-estado/temario`,
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