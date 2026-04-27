const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Policía Nacional 2026 | Vence',
  description: 'Temario completo de Policía Nacional actualizado 2026. 45 temas oficiales: Derecho, Seguridad, TIC, Inglés y Ortografía.',
  keywords: [
    'temario policía nacional',
    'temario policía nacional 2026',
    'temario oficial policía nacional',
    'temas policía nacional escala básica',
    'temario oposiciones policía nacional',
    'temario gratis policía nacional'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Policía Nacional 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Policía Nacional. 45 temas oficiales con teoría completa.',
    url: `${SITE_URL}/policia-nacional/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Policía Nacional',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Policía Nacional | Vence',
    description: 'Temario completo y actualizado 2026. 45 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/policia-nacional/temario`,
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

export default function TemarioLayout({ children }: { children: React.ReactNode }) {
  return children
}
