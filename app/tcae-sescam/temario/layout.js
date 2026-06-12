const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario TCAE SESCAM 2026 | 30 Temas Oficiales | Vence',
  description: 'Temario oficial DOCM de TCAE (Auxiliar de Enfermería) del SESCAM (Castilla-La Mancha). 30 temas en 2 bloques: legislación y organización sanitaria + cuidados auxiliares de enfermería.',
  keywords: [
    'temario tcae sescam',
    'temario auxiliar enfermeria castilla la mancha',
    'temario tcae sescam 2026',
    'temario oficial tcae clm',
    'temas tcae sescam',
    'teoria tcae servicio salud castilla la mancha',
    'temario gratis tcae sescam'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario TCAE SESCAM - 30 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de TCAE del Servicio de Salud de Castilla-La Mancha. 30 temas oficiales según el programa DOCM.',
    url: `${SITE_URL}/tcae-sescam/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario TCAE SESCAM' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario TCAE SESCAM | Vence',
    description: 'Temario completo y actualizado 2026. 30 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: { canonical: `${SITE_URL}/tcae-sescam/temario` },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

export default function TemarioLayout({ children }) {
  return children
}
