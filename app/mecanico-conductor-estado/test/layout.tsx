const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tests Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado 2026 | 15 Temas Oficiales | Vence',
  description: 'Tests de Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado con los 15 temas oficiales del BOE. Preguntas personalizables, estadísticas por tema y seguimiento de progreso. Subgrupo E2.',
  keywords: ['parque movil del estado', 'parque móvil del estado', 'conductor parque movil', 'conductor del parque movil del estado', 'mecanico conductor del estado', 'conduccion de vehiculos de transporte por carretera', 'pme conductor', 'conductor age'].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tests Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado - 15 Temas Oficiales | Vence',
    description: 'Practica con tests de Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado. 15 temas oficiales en 2 partes, estadísticas personalizadas y seguimiento de progreso.',
    url: `${SITE_URL}/mecanico-conductor-estado/test`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Tests Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado | Vence',
    description: 'Tests de los 15 temas oficiales del BOE. Estadísticas por tema y progreso personalizado.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/mecanico-conductor-estado/test`,
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

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
