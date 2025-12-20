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
    <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-6">
              <span className="inline-block text-6xl mb-4">🏛️</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Vence - Preparación de Oposiciones
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Tu plataforma de estudio para conseguir tu plaza de funcionario
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-blue-200">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📚</span>
                <span className="text-sm md:text-base">+5.000 preguntas</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🎯</span>
                <span className="text-sm md:text-base">Tests ilimitados</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📊</span>
                <span className="text-sm md:text-base">Seguimiento detallado</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        
        {/* Oposición Destacada */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-blue-900 dark:text-blue-300 mb-4">
              🎯 Oposición Destacada
            </h2>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              Auxiliar Administrativo del Estado
            </h3>
            <div className="flex flex-wrap justify-center gap-4 text-lg font-semibold mb-6">
              <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full">
                🎯 1.700+ plazas
              </span>
              <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
                📚 Solo ESO
              </span>
              <span className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full">
                💰 18.000€+/año
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-lg mb-6">
              La oposición más accesible con gran número de plazas convocadas
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/auxiliar-administrativo-estado"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors text-lg"
              >
                👨‍💼 Ver Oposición
              </Link>
              <Link
                href="/oposiciones"
                className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors text-lg"
              >
                🏛️ Todas las Oposiciones
              </Link>
            </div>
          </div>
        </div>

        {/* Características de la plataforma */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-300 mb-6 text-center">
            ✨ ¿Por qué elegir Vence?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="font-semibold mb-2 dark:text-gray-200">Contenido Actualizado</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">Más de 5.000 preguntas actualizadas con las últimas modificaciones normativas</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-semibold mb-2 dark:text-gray-200">Tests Inteligentes</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">Sistema adaptativo que se enfoca en tus áreas de mejora</p>
            </div>
            <div className="text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-semibold mb-2 dark:text-gray-200">Seguimiento Completo</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">Estadísticas detalladas de tu progreso y rendimiento</p>
            </div>
          </div>
        </section>

        {/* Estructura del Examen 2025 */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-300 mb-6 text-center">
            📝 Examen Auxiliar Administrativo del Estado 2025
          </h2>
          <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-6 mb-6">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">
              ¡Buenas noticias! El examen se ha simplificado
            </h3>
            <p className="text-green-700 dark:text-green-300">
              Ahora es <strong>un solo examen en un único día</strong>, máximo 90 minutos. 
              Ya no hay prueba práctica de Office en ordenador.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
              <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-3">
                📚 Primer Ejercicio: Teoría + Psicotécnicas
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-white dark:bg-gray-700 p-3 rounded">
                  <strong>60 preguntas tipo test:</strong>
                  <br />• 30 preguntas del Bloque I (teoría)
                  <br />• 30 preguntas psicotécnicas
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  <strong>Puntuación:</strong>
                  <br />• Acertadas: +1 punto
                  <br />• Falladas: -1/3 punto
                  <br />• No contestadas: 0 puntos
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
              <h3 className="font-bold text-purple-800 dark:text-purple-300 mb-3">
                💻 Segundo Ejercicio: Ofimática
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-white dark:bg-gray-700 p-3 rounded">
                  <strong>50 preguntas tipo test:</strong>
                  <br />• Sobre el Bloque II (ofimática)
                  <br />• Windows 10 y Office 365
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  <strong>Puntuación:</strong>
                  <br />• Acertadas: +1 punto
                  <br />• Falladas: -1/3 punto
                  <br />• No contestadas: 0 puntos
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mt-6 text-center">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-2">110</div>
                <p className="font-semibold dark:text-gray-200">Preguntas totales</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">60 + 50 preguntas</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 mb-2">90</div>
                <p className="font-semibold dark:text-gray-200">Minutos máximo</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">En un solo día</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-600 mb-2">-1/3</div>
                <p className="font-semibold dark:text-gray-200">Penalización</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Por respuesta incorrecta</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="bg-gradient-to-r from-blue-600 to-green-600 rounded-lg shadow-lg p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">¿Listo para conseguir tu plaza?</h2>
          <p className="text-lg mb-6">
            Únete a miles de opositores que ya confían en Vence
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/oposiciones"
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              🏛️ Ver Oposiciones
            </Link>
            <Link
              href="/test/rapido"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              🚀 Test Gratis
            </Link>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-gray-600 dark:text-gray-400 text-sm mt-8">
          <p>Vence • Plataforma de preparación de oposiciones • +5.000 preguntas actualizadas</p>
        </div>
        
      </div>
    </div>
  )
}