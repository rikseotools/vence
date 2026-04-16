const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario TCAE Osakidetza País Vasco 2026 | Vence',
  description: 'Temario oficial de Auxiliar de Enfermería (TCAE) de Osakidetza actualizado 2026. 49 temas en 2 bloques: legislación sanitaria vasca + funciones TCAE.',
  keywords: [
    'temario tcae osakidetza',
    'temario auxiliar enfermeria pais vasco',
    'temario tcae euskadi 2026',
    'temario oficial tcae osakidetza',
    'temas tcae osakidetza',
    'teoria tcae servicio vasco salud',
    'temario gratis tcae osakidetza'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario TCAE Osakidetza (País Vasco) 2026 | Teoría Oficial',
    description: 'Temario completo y actualizado de TCAE Osakidetza. 49 temas oficiales según BOPV 20/03/2026.',
    url: `${SITE_URL}/auxiliar-enfermeria-osakidetza/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario TCAE Osakidetza',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario TCAE Osakidetza País Vasco | Vence',
    description: 'Temario completo y actualizado 2026. 49 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-enfermeria-osakidetza/temario`,
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
