const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) 2026 | Vence',
  description: 'Temario completo del Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) actualizado 2026. 14 temas oficiales organizados en 2 partes.',
  keywords: ['celador sms murcia', 'celador subalterno murcia', 'celador servicio murciano de salud', 'oposicion celador murcia', 'celadores sms'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) 2026 | Vence',
    description: 'Accede al temario completo del Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS). 14 temas oficiales organizados en 2 partes.',
    url: `${SITE_URL}/celador-murcia/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) | Vence',
    description: 'Temario completo y actualizado 2026. 14 temas oficiales del Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS).',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/celador-murcia/temario`,
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
