const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Enfermero ICS 2025 | 19 Temas Oficiales | Vence',
  description: 'Temario oficial de Enfermero/a del Institut Català de la Salut. 19 temas de cuidados de enfermería, metodología y clínica.',
  keywords: [
    'temario enfermero ics',
    'temario enfermero cataluña',
    'temario enfermero ics 2025',
    'temario oficial enfermero cataluña',
    'temas enfermero ics',
    'teoria enfermero institut catala salut',
    'temario gratis enfermero cataluña'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Enfermero ICS - 19 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Enfermero/a del Institut Català de la Salut. 19 temas oficiales segun DOGC.',
    url: `${SITE_URL}/enfermero-ics/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Enfermero ICS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Enfermero ICS | Vence',
    description: 'Temario completo y actualizado 2025. 19 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/enfermero-ics/temario`,
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
