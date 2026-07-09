const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativa - Universidad de Murcia 2026 | Vence',
  description: 'Temario completo de Administrativa - Universidad de Murcia actualizado 2026. 18 temas oficiales con teoría.',
  keywords: [
    'temario técnico auxiliar (auxiliar de servicios) universidad de murcia',
    'temario auxiliar universidad de murcia 2026',
    'temario oficial auxiliar universidad de murcia',
    'temario oposiciones universidad de murcia',
    'temas técnico auxiliar (auxiliar de servicios) universidad de murcia',
    'teoría auxiliar universidad de murcia',
    'temario gratis auxiliar universidad de murcia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativa - Universidad de Murcia 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Administrativa - Universidad de Murcia. 18 temas oficiales con teoría completa.',
    url: `${SITE_URL}/administrativa-universidad-de-murcia/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativa - Universidad de Murcia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativa - Universidad de Murcia | Vence',
    description: 'Temario completo y actualizado 2026. 18 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/administrativa-universidad-de-murcia/temario`,
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
