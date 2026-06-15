const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario TCAE SES Extremadura 2026 | 30 Temas Oficiales | Vence',
  description: 'Temario oficial DOE de TCAE (Auxiliar de Enfermería) del SES (Extremadura). 30 temas en 2 bloques: legislación y organización sanitaria + cuidados auxiliares de enfermería.',
  keywords: [
    'temario tcae ses-extremadura',
    'temario auxiliar enfermeria extremadura',
    'temario tcae ses-extremadura 2026',
    'temario oficial tcae extremadura',
    'temas tcae ses-extremadura',
    'teoria tcae servicio salud extremadura',
    'temario gratis tcae ses-extremadura'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario TCAE SES Extremadura - 30 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de TCAE del Servicio Extremeño de Salud. 30 temas oficiales según el programa DOE.',
    url: `${SITE_URL}/tcae-extremadura/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/og-image-es.jpg', width: 1200, height: 630, alt: 'Vence - Temario TCAE SES Extremadura' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario TCAE SES Extremadura | Vence',
    description: 'Temario completo y actualizado 2026. 30 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: { canonical: `${SITE_URL}/tcae-extremadura/temario` },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

export default function TemarioLayout({ children }) {
  return children
}
