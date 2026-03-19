const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Junta de Castilla-La Mancha | Vence',
  description: 'Temario completo de Auxiliar Administrativo Junta de Castilla-La Mancha. 24 temas oficiales organizados en 2 bloques con teoria.',
  keywords: [
    'temario auxiliar administrativo clm',
    'temario auxiliar castilla la mancha',
    'temario oficial auxiliar clm',
    'temario oposiciones jccm',
    'temas auxiliar administrativo clm',
    'teoria auxiliar clm',
    'temario gratis auxiliar clm'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Junta de Castilla-La Mancha | Teoria Oficial',
    description: 'Accede al temario completo y actualizado de Auxiliar Administrativo JCCM. 24 temas oficiales con teoria completa.',
    url: `${SITE_URL}/auxiliar-administrativo-clm/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario Auxiliar Administrativo CLM' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Junta de Castilla-La Mancha | Vence',
    description: 'Temario completo y actualizado. 24 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-clm/temario`,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function TemarioLayout({ children }) {
  return children
}
