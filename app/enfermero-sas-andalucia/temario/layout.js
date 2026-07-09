const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Enfermero SAS Andalucía 2025 | 79 Temas Oficiales | Vence',
  description: 'Temario oficial de Enfermero/a del Servicio Andaluz de Salud. 79 temas de cuidados de enfermería, metodología y clínica.',
  keywords: [
    'temario enfermero sas',
    'temario enfermero andalucia',
    'temario enfermero sas 2025',
    'temario oficial enfermero andalucia',
    'temas enfermero sas',
    'teoria enfermero servicio andaluz salud',
    'temario gratis enfermero andalucia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Enfermero SAS Andalucía - 79 Temas Oficiales | Vence',
    description: 'Temario completo y actualizado de Enfermero/a del Servicio Andaluz de Salud. 79 temas oficiales segun BOJA.',
    url: `${SITE_URL}/enfermero-sas-andalucia/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Enfermero SAS Andalucía',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Enfermero SAS Andalucía | Vence',
    description: 'Temario completo y actualizado 2025. 79 temas oficiales con teoria.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/enfermero-sas-andalucia/temario`,
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
