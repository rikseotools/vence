const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Administrativo Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado 2026 | Vence',
  description: 'Temario completo del Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado actualizado 2026. 15 temas oficiales organizados en 2 partes.',
  keywords: ['parque movil del estado', 'parque móvil del estado', 'conductor parque movil', 'conductor del parque movil del estado', 'mecanico conductor del estado', 'conduccion de vehiculos de transporte por carretera', 'pme conductor', 'conductor age'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Administrativo Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado 2026 | Vence',
    description: 'Accede al temario completo del Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado. 15 temas oficiales organizados en 2 partes.',
    url: `${SITE_URL}/mecanico-conductor-estado/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Administrativo Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Administrativo Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado | Vence',
    description: 'Temario completo y actualizado 2026. 15 temas oficiales del Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/mecanico-conductor-estado/temario`,
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
