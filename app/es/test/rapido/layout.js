const SITE_URL = process.env.SITE_URL || 'https://www.ilovetest.pro'

export const metadata = {
  title: 'Test Rápido de Oposiciones | Práctica Express | iLoveTest',
  description: 'Test rápido para retomar el estudio y practicar con preguntas aleatorias. Ideal para mantener el ritmo de preparación y reactivar el aprendizaje.',
  keywords: [
    'test rapido oposiciones',
    'test express auxiliar administrativo',
    'practica rapida oposiciones',
    'test reactivacion estudio',
    'preguntas rapidas oposiciones',
    'test motivacional',
    'practica express',
    'reactivar estudio oposiciones'
  ].join(', '),
  authors: [{ name: 'iLoveTest' }],
  creator: 'iLoveTest',
  publisher: 'iLoveTest',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Test Rápido de Oposiciones | Práctica Express',
    description: 'Retoma tu estudio con un test rápido. Ideal para mantener el ritmo y reactivar tu preparación.',
    url: `${SITE_URL}/es/test/rapido`,
    siteName: 'iLoveTest',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'iLoveTest - Test Rápido',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Test Rápido de Oposiciones | iLoveTest',
    description: 'Práctica rápida para retomar el ritmo de estudio.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/es/test/rapido`,
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

export default function TestRapidoLayout({ children }) {
  return children
}