import Link from 'next/link'

export const metadata = {
  title: 'Secuencias Numéricas - Tests Psicotécnicos Online Gratuitos',
  description: 'Practica secuencias numéricas con nuestros tests psicotécnicos gratuitos. Series lógicas de números para oposiciones y exámenes de aptitudes. Mejora tu razonamiento matemático.',
  keywords: 'secuencias numericas, series numericas, test psicotecnico, secuencias logicas, series matematicas, razonamiento numerico, aptitudes numericas, tests oposiciones, examenes psicotecnicos',
  openGraph: {
    title: 'Secuencias Numéricas - Tests Psicotécnicos Online Gratuitos',
    description: 'Practica secuencias numéricas con nuestros tests psicotécnicos gratuitos. Series lógicas de números para oposiciones y exámenes de aptitudes.',
    url: 'https://vence.es/psicotecnicos/secuencias-numericas',
    type: 'website',
    siteName: 'Vence - Preparación de Oposiciones'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Secuencias Numéricas - Tests Psicotécnicos Online Gratuitos',
    description: 'Practica secuencias numéricas con nuestros tests psicotécnicos gratuitos. Series lógicas de números para oposiciones.'
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
  alternates: {
    canonical: 'https://vence.es/psicotecnicos/secuencias-numericas'
  }
}

export default function SecuenciasNumericasLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Secuencias Numéricas
          </h1>
          <p className="text-xl text-gray-700 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Domina las secuencias numéricas con nuestros tests psicotécnicos especializados. 
            Practica series lógicas de números y mejora tu razonamiento matemático para oposiciones.
          </p>
          
          <Link 
            href="/psicotecnicos/test"
            className="inline-flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 text-lg"
          >
            🚀 Empezar Test de Secuencias Numéricas
          </Link>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-12 mb-12">
          {/* Left Column - What are Numeric Sequences */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              ¿Qué son las Secuencias Numéricas?
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Las secuencias numéricas son series de números que siguen un patrón o regla lógica específica. 
              Son fundamentales en los exámenes psicotécnicos para evaluar el razonamiento lógico-matemático.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Estos ejercicios miden tu capacidad para identificar patrones, realizar cálculos mentales 
              y aplicar razonamiento deductivo bajo presión de tiempo.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Ejemplos de secuencias:
              </h3>
              <ul className="text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Aritméticas: 2, 4, 6, 8, ?</li>
                <li>• Geométricas: 3, 6, 12, 24, ?</li>
                <li>• Cuadráticas: 1, 4, 9, 16, ?</li>
                <li>• Combinadas: 1, 4, 2, 8, 3, ?</li>
              </ul>
            </div>

            <Link 
              href="/psicotecnicos/test"
              className="inline-block w-full text-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Practicar Ahora →
            </Link>
          </div>

          {/* Right Column - Why Practice */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              ¿Por qué Practicar Secuencias Numéricas?
            </h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Oposiciones</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Presentes en la mayoría de exámenes de acceso a la administración pública
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Aptitud Mental</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Desarrolla habilidades de cálculo mental y razonamiento lógico
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Velocidad</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Mejora tu rapidez para resolver problemas bajo presión temporal
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">4</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Confianza</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Aumenta tu seguridad en exámenes psicotécnicos reales
                  </p>
                </div>
              </div>
            </div>

            <Link 
              href="/psicotecnicos/test"
              className="inline-block w-full text-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              Comenzar Entrenamiento →
            </Link>
          </div>
        </div>

        {/* Types of Sequences Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Tipos de Secuencias Numéricas
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
              <div className="text-3xl mb-3">➕</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Aritméticas</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Diferencia constante entre términos consecutivos
              </p>
            </div>

            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
              <div className="text-3xl mb-3">✖️</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Geométricas</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Razón constante entre términos consecutivos
              </p>
            </div>

            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
              <div className="text-3xl mb-3">²</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Cuadráticas</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Basadas en potencias y operaciones complejas
              </p>
            </div>

            <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg">
              <div className="text-3xl mb-3">🔀</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Mixtas</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Combinación de diferentes patrones
              </p>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link 
              href="/psicotecnicos/test"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              🎯 Practicar Todos los Tipos
            </Link>
          </div>
        </div>

        {/* Tips Section */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8 text-white mb-12">
          <h2 className="text-3xl font-bold mb-6 text-center">
            Consejos para Resolver Secuencias Numéricas
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">🔍 Analiza el Patrón</h3>
              <p className="text-sm opacity-90">
                Observa las diferencias entre números consecutivos. ¿Son constantes? ¿Siguen otro patrón?
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">⚡ Practica la Velocidad</h3>
              <p className="text-sm opacity-90">
                En exámenes reales el tiempo es limitado. Entrena para reconocer patrones rápidamente.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">📝 Usa Papel</h3>
              <p className="text-sm opacity-90">
                Anota las operaciones. Visualizar los cálculos te ayudará a encontrar la solución.
              </p>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link 
              href="/psicotecnicos/test"
              className="inline-flex items-center px-8 py-4 bg-white text-purple-600 font-semibold rounded-lg shadow-lg hover:bg-gray-50 transform hover:scale-105 transition-all duration-200"
            >
              💪 Empezar a Entrenar
            </Link>
          </div>
        </div>

        {/* Final CTA Section */}
        <div className="text-center bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            ¿Listo para Dominar las Secuencias Numéricas?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Únete a miles de estudiantes que ya están mejorando sus habilidades con nuestros tests especializados. 
            ¡Comienza ahora y prepárate para el éxito en tus exámenes!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/psicotecnicos/test"
              className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 text-lg"
            >
              🎯 Test de Secuencias Numéricas
            </Link>
            
            <Link 
              href="/psicotecnicos"
              className="inline-flex items-center justify-center px-8 py-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 text-lg"
            >
              📚 Ver Todos los Tests Psicotécnicos
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}