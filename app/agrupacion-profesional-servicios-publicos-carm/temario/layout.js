const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Junta Murcia 2026 | Vence',
  description: 'Temario completo del Agrupación Profesional de Servicios Públicos de la CARM actualizado 2026. 12 temas oficiales organizados en 2 bloques.',
  keywords: [
    'temario administrativo murcia',
    'temario agrupacion profesional servicios publicos murcia 2026',
    'temario oficial agrupacion profesional servicios publicos murcia',
    'oposiciones administrativo murcia',
    'temario cuerpo administrativo murcia',
    'temas agrupacion profesional servicios publicos murcia',
    'temario gratis administrativo murcia',
    '48 plazas administrativo murcia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Junta Murcia 2026 | Vence',
    description: 'Accede al temario completo del Agrupación Profesional de Servicios Públicos de la CARM. 12 temas oficiales organizados en 2 bloques.',
    url: `${SITE_URL}/agrupacion-profesional-servicios-publicos-carm/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Junta Murcia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Junta Murcia | Vence',
    description: 'Temario completo y actualizado 2026. 12 temas oficiales del Cuerpo Administrativo.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/agrupacion-profesional-servicios-publicos-carm/temario`,
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
