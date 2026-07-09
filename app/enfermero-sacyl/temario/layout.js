const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Enfermero SACYL 2025 | 54 Temas Oficiales | Vence',
  description: 'Temario oficial de Enfermero/a del Servicio de Salud de Castilla y León. 54 temas de cuidados de enfermería, metodología y clínica.',
  keywords: [
    'temario enfermero sacyl',
    'temario enfermero castilla y leon',
    'temario enfermero sacyl 2025',
    'temario oficial enfermero castilla y leon',
    'temas enfermero sacyl',
    'teoria enfermero servicio salud castilla y leon',
    'temario gratis enfermero castilla y leon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Enfermero SACYL - 54 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Enfermero/a del Servicio de Salud de Castilla y León. 54 temas oficiales segun BOCyL.',
    url: `${SITE_URL}/enfermero-sacyl/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Enfermero SACYL',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Enfermero SACYL | Vence',
    description: 'Temario completo y actualizado 2025. 54 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/enfermero-sacyl/temario`,
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
