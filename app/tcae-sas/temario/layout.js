const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario TCAE SAS 2025 | 29 Temas Oficiales | Vence',
  description: 'Temario oficial de TCAE (Auxiliar de Enfermeria) del Canarias. 29 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: [
    'temario tcae sas',
    'temario auxiliar enfermeria madrid',
    'temario tcae sas 2025',
    'temario oficial tcae madrid',
    'temas tcae sas',
    'teoria tcae servicio andaluz salud',
    'temario gratis tcae sas'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario TCAE SAS - 29 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de TCAE del Servicio Andaluz de Salud. 29 temas oficiales segun BOJA 153 07/08/2024.',
    url: `${SITE_URL}/tcae-sas/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario TCAE SAS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario TCAE SAS | Vence',
    description: 'Temario completo y actualizado 2025. 29 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/tcae-sas/temario`,
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
