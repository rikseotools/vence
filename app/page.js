// app/page.js
import Link from 'next/link'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Test de Oposiciones y Leyes | Vence',
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
    canonical: SITE_URL,
    languages: {
      'es-ES': SITE_URL,
      'x-default': SITE_URL
    }
  },
  openGraph: {
    title: 'Tests de Oposiciones y Leyes | Vence',
    description: 'Practica con +5000 tests gratuitos de legislación española y prepara tus oposiciones online. Constitución, Ley 39/2015, Guardia Civil y más.',
    url: SITE_URL,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests de Oposiciones y Leyes| Vence',
    description: 'Prepara tus oposiciones con Vence.',
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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16 max-w-3xl">

        {/* Hero Simple */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-white mb-4">
            Vence
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-2">
            Plataforma de tests para oposiciones y leyes
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            +20.000 preguntas
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            Última revisión: 26 diciembre 2025
          </p>
        </div>

        {/* Dos opciones principales */}
        <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
          Puedes hacer Test por oposición o por leyes
        </p>
        <div className="grid md:grid-cols-2 gap-6 mb-12">

          {/* Opción 1: Oposiciones */}
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">🏛️</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              Test por Oposición
            </h2>
            <div className="space-y-3">
              <Link
                href="/auxiliar-administrativo-estado"
                className="block py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
              >
                Auxiliar Administrativo (C2)
              </Link>
              <Link
                href="/administrativo-estado"
                className="block py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
              >
                Administrativo del Estado (C1)
              </Link>
            </div>
          </div>

          {/* Opción 2: Leyes */}
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              Test de Leyes
            </h2>
            <div className="space-y-2">
              <Link
                href="/leyes/constitucion-espanola"
                className="block py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
              >
                Constitución Española
              </Link>
              <Link
                href="/leyes/ley-39-2015"
                className="block py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
              >
                Ley 39/2015 (LPAC)
              </Link>
              <Link
                href="/leyes/ley-40-2015"
                className="block py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
              >
                Ley 40/2015 (LRJSP)
              </Link>
              <Link
                href="/leyes/rdl-5-2015"
                className="block py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
              >
                EBEP (RDL 5/2015)
              </Link>
              <Link
                href="/leyes/ley-19-2013"
                className="block py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm"
              >
                Ley 19/2013 (Transparencia)
              </Link>
              <Link
                href="/leyes"
                className="block py-2 px-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm"
              >
                +45 leyes más →
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}