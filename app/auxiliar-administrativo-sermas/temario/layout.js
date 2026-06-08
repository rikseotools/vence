const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo SERMAS 2025 | 31 Temas Oficiales | Vence',
  description: 'Temario oficial del Auxiliar Administrativo del SERMAS (Servicio Madrileno de Salud). 31 temas en 5 bloques segun BOCM de 04/07/2025.',
  keywords: [
    'temario auxiliar administrativo sermas',
    'temario aux admin sermas madrid',
    'temario auxiliar administrativo sermas 2025',
    'temario oficial aux admin sermas',
    'temas auxiliar administrativo sermas',
    'teoria auxiliar administrativo servicio madrileno salud',
    'temario gratis auxiliar administrativo sermas'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo SERMAS - 31 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Auxiliar Administrativo del SERMAS. 31 temas oficiales segun BOCM 04/07/2025.',
    url: `${SITE_URL}/auxiliar-administrativo-sermas/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo SERMAS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo SERMAS | Vence',
    description: 'Temario completo y actualizado 2025. 31 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-sermas/temario`,
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
