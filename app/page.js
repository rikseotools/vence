// app/page.js
import Link from 'next/link'

const SITE_URL = process.env.SITE_URL || 'https://www.ilovetest.pro'

export const metadata = {
  title: 'Test de Oposiciones y Leyes | iLoveTest',
  description: 'Tests gratuitos de leyes españolas y oposiciones. Constitución Española, Ley 39/2015, Guardia Civil, Administrativo. +5000 preguntas actualizadas.',
  keywords: [
    'test de ley',
    'test oposiciones',
    'test constitución española', 
    'ley 39/2015 test',
    'test de leyes',
    'test oposiciones gratis',
    'test guardia civil',
    'test administrativo del estado',
    'test auxilio judicial',
    'test tramitación procesal',
    'tests jurídicos españa'
  ].join(', '),
  authors: [{ name: 'Tests Jurídicos España' }],
  creator: 'Tests Jurídicos España',
  publisher: 'Tests Jurídicos España',
  metadataBase: new URL(SITE_URL),
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: `${SITE_URL}/es`,
    languages: {
      'en-US': SITE_URL,
      'es-ES': `${SITE_URL}/es`,
      'x-default': SITE_URL
    }
  },
  openGraph: {
    title: 'Tests de Oposiciones y Leyes | iLoveTest',
    description: 'Practica con +5000 tests gratuitos de legislación española y prepara tus oposiciones online. Constitución, Ley 39/2015, Guardia Civil y más.',
    url: `${SITE_URL}/es`,
    siteName: 'iLoveTest',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'iLoveTest',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests de Oposiciones y Leyes| iLoveTest',
    description: 'Prepara tus oposiciones con iLoveTest.',
    images: ['/twitter-image-es.jpg'],
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

export default function SpanishHub() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-red-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header Simple */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Tests de Oposiciones y Leyes 
          </h1>
          <p className="text-gray-600 mb-6">
            Prepara tu oposicion con iLoveTest
          </p>
          
          {/* Botones de Navegación */}
          <div className="flex justify-center gap-4 mb-8">
            <a 
              href="#oposiciones"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              🎯 Tests por Oposición
            </a>
            <a 
              href="#leyes"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              📚 Tests por Leyes
            </a>
          </div>
        </div>

        {/* Sección Oposiciones */}
        <section id="oposiciones" className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            🎯 Tests por Oposición
          </h2>
          
          {/* Auxiliar Administrativo - Simplificado */}
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-center mb-4">
                <span className="text-3xl">🏛️</span>
                <h3 className="text-xl font-bold text-gray-800 mt-2">
                  Auxiliar Administrativo Estado
                </h3>
              </div>
              
              <div className="flex gap-4 justify-center">
                <Link
                  href="/auxiliar-administrativo-estado/test"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  📝 Tests
                </Link>
                <Link
                  href="/auxiliar-administrativo-estado/temario"
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  📚 Temario
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Sección Leyes - ACTUALIZADA */}
        <section id="leyes" className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            📚 Tests por Leyes
          </h2>
          
          {/* Enlace a todas las leyes disponibles */}
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-center">
                <span className="text-3xl">📚</span>
                <h3 className="text-xl font-bold text-gray-800 mt-2 mb-2">
                  Todas las Leyes Españolas
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Constitución, Ley 39/2015, Código Civil, Código Penal y más
                </p>
                
                <Link
                  href="/leyes"
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                >
                  📖 Ver Todas las Leyes
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Simple */}
        <div className="text-center text-gray-600 text-sm">
          <p>Tests gratuitos actualizados • Legislación española • Oposiciones 2024</p>
        </div>
        
      </div>
    </div>
  )
}