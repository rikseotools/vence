const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Mis Estadísticas con IA | Análisis Avanzado de Progreso | iLoveTest',
  description: 'Panel completo de estadísticas con análisis de IA. Progreso semanal, rendimiento por temas, predicciones de examen y recomendaciones personalizadas.',
  keywords: [
    'estadisticas estudio ia',
    'analisis progreso oposiciones',
    'estadisticas auxiliar administrativo',
    'seguimiento progreso estudio',
    'metricas rendimiento oposiciones',
    'dashboard estudiante',
    'analisis inteligencia artificial',
    'predicciones examen oposiciones'
  ].join(', '),
  authors: [{ name: 'iLoveTest' }],
  creator: 'iLoveTest',
  publisher: 'iLoveTest',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Estadísticas con IA | Análisis Completo de Progreso',
    description: 'Accede a tu panel personalizado con estadísticas avanzadas, análisis de IA y predicciones de rendimiento.',
    url: `${SITE_URL}/mis-estadisticas`,
    siteName: 'iLoveTest',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'iLoveTest - Estadísticas con IA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Estadísticas con IA | iLoveTest',
    description: 'Dashboard personalizado con análisis avanzado y predicciones de rendimiento.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/mis-estadisticas`,
  },
  robots: {
    index: false, // Las páginas de estadísticas personales no deben indexarse
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export default function EstadisticasLayout({ children }) {
  return children
}