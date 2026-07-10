const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Enfermero SMS Murcia 2025 | 71 Temas Oficiales | Vence',
  description: 'Temario oficial de Enfermero/a del Servicio Murciano de la Salud. 71 temas de cuidados de enfermería, metodología y clínica.',
  keywords: [
    'temario enfermero sms',
    'temario enfermero murcia',
    'temario enfermero sms 2025',
    'temario oficial enfermero murcia',
    'temas enfermero sms',
    'teoria enfermero servicio murciano salud',
    'temario gratis enfermero murcia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Enfermero SMS Murcia - 71 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Enfermero/a del Servicio Murciano de la Salud. 71 temas oficiales segun BOC.',
    url: `${SITE_URL}/enfermero-sms/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Enfermero SMS Murcia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Enfermero SMS Murcia | Vence',
    description: 'Temario completo y actualizado 2025. 71 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/enfermero-sms/temario`,
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
