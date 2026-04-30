const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Guardia Civil 2026 | Vence',
  description: 'Temario completo de Guardia Civil actualizado 2026. 25 temas oficiales: Derecho, Seguridad, TIC, Inglés y Ortografía.',
  keywords: [
    'temario guardia civil',
    'temario guardia civil 2026',
    'temario oficial guardia civil',
    'temas guardia civil cabos y guardias',
    'temario oposiciones guardia civil',
    'temario gratis guardia civil'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Guardia Civil 2026 | Teoría Oficial',
    description: 'Accede al temario completo y actualizado de Guardia Civil. 25 temas oficiales con teoría completa.',
    url: `${SITE_URL}/guardia-civil/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Guardia Civil',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Guardia Civil | Vence',
    description: 'Temario completo y actualizado 2026. 25 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/guardia-civil/temario`,
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
