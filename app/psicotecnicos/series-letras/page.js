import { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Series de Letras - Tests Psicotécnicos Gratis | Vence.es',
  description: 'Practica series de letras para oposiciones con ejercicios interactivos gratis. Resuelve patrones alfabéticos, series correlativas y mejora tu razonamiento lógico para auxiliar administrativo.',
  keywords: 'series letras, series de letras, tests psicotécnicos, series alfabéticas, patrones letras, razonamiento lógico, oposiciones, auxiliar administrativo, ejercicios series letras gratis',
  openGraph: {
    title: 'Series de Letras - Tests Psicotécnicos Gratis',
    description: 'Domina las series de letras con ejercicios interactivos. Practica patrones alfabéticos y series correlativas para tus oposiciones.',
    url: `${SITE_URL}/psicotecnicos/series-letras`,
    siteName: 'Vence.es',
    images: [
      {
        url: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'Series de Letras - Tests Psicotécnicos'
      }
    ],
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Series de Letras - Tests Psicotécnicos Gratis',
    description: 'Practica series de letras para oposiciones. Ejercicios interactivos gratis con explicaciones detalladas.',
    images: [`${SITE_URL}/og-image.jpg`]
  },
  alternates: {
    canonical: `${SITE_URL}/psicotecnicos/series-letras`
  }
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Series de Letras - Tests Psicotécnicos',
  description: 'Practica series de letras para oposiciones con ejercicios interactivos gratis. Resuelve patrones alfabéticos y series correlativas.',
  url: `${SITE_URL}/psicotecnicos/series-letras`,
  mainEntity: {
    '@type': 'LearningResource',
    name: 'Tests de Series de Letras',
    description: 'Ejercicios interactivos de series de letras para preparación de oposiciones',
    educationalLevel: 'Intermediate',
    learningResourceType: 'Exercise',
    teaches: [
      'Series alfabéticas',
      'Patrones de letras',
      'Razonamiento lógico',
      'Series correlativas'
    ],
    provider: {
      '@type': 'Organization',
      name: 'Vence.es',
      url: `${SITE_URL}`
    }
  },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: `${SITE_URL}`
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Tests Psicotécnicos',
        item: `${SITE_URL}/psicotecnicos`
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Series de Letras',
        item: `${SITE_URL}/psicotecnicos/series-letras`
      }
    ]
  }
}

export default function SeriesLetrasPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Hero Section */}
        <section className="relative py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Series de Letras
              <span className="block text-blue-600 mt-2">Tests Psicotécnicos Gratis</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-700 mb-8 leading-relaxed">
              Domina las <strong>series de letras</strong> con ejercicios interactivos diseñados para oposiciones. 
              Practica patrones alfabéticos, series correlativas y mejora tu razonamiento lógico.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link 
                href="/psicotecnicos/test"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                🚀 Comenzar Test de Series de Letras
              </Link>
              
              <Link 
                href="/psicotecnicos/test"
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                📝 Practicar Ahora Gratis
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-3xl mb-3">🎯</div>
                <h3 className="font-semibold text-lg mb-2">Ejercicios Especializados</h3>
                <p className="text-gray-600">Tests específicos de series de letras adaptados a oposiciones reales</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="font-semibold text-lg mb-2">Explicaciones Detalladas</h3>
                <p className="text-gray-600">Aprende el patrón y la lógica detrás de cada serie alfabética</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="font-semibold text-lg mb-2">Resultados Inmediatos</h3>
                <p className="text-gray-600">Feedback instantáneo para mejorar tu rendimiento</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tipos de Series de Letras */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Tipos de Series de Letras que Practicarás
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-blue-800 mb-4">🔤 Series Correlativas</h3>
                <p className="text-gray-700 mb-4">
                  Secuencias donde las letras siguen un patrón específico basado en el orden alfabético.
                </p>
                <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                  <strong>Ejemplo:</strong> a, c, e, g, i, ? 
                  <br />
                  <span className="text-sm text-gray-600">Respuesta: k (salto de 2 letras)</span>
                </div>
              </div>
              
              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-green-800 mb-4">🔄 Series Intercaladas</h3>
                <p className="text-gray-700 mb-4">
                  Dos o más series de letras que se alternan siguiendo patrones diferentes.
                </p>
                <div className="bg-white p-3 rounded border-l-4 border-green-500">
                  <strong>Ejemplo:</strong> a, x, c, v, e, t, g, ?
                  <br />
                  <span className="text-sm text-gray-600">Respuesta: r (series alternadas)</span>
                </div>
              </div>
              
              <div className="bg-purple-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-purple-800 mb-4">📈 Series Crecientes/Decrecientes</h3>
                <p className="text-gray-700 mb-4">
                  Secuencias que siguen incrementos o decrementos constantes en el alfabeto.
                </p>
                <div className="bg-white p-3 rounded border-l-4 border-purple-500">
                  <strong>Ejemplo:</strong> z, y, x, w, v, ?
                  <br />
                  <span className="text-sm text-gray-600">Respuesta: u (secuencia decreciente)</span>
                </div>
              </div>
              
              <div className="bg-orange-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-orange-800 mb-4">🎲 Series con Repetición</h3>
                <p className="text-gray-700 mb-4">
                  Patrones donde algunas letras se repiten siguiendo una lógica específica.
                </p>
                <div className="bg-white p-3 rounded border-l-4 border-orange-500">
                  <strong>Ejemplo:</strong> a, a, b, c, c, d, e, e, ?
                  <br />
                  <span className="text-sm text-gray-600">Respuesta: f (patrón de repetición)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Estrategias para Resolver */}
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Estrategias para Resolver Series de Letras
            </h2>
            
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-blue-600 mb-3">1. 🔍 Identifica el Patrón</h3>
                <p className="text-gray-700">
                  Observa la distancia entre letras consecutivas. ¿Aumenta o disminuye de forma constante? 
                  ¿Hay saltos regulares en el alfabeto?
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-green-600 mb-3">2. 🧮 Cuenta las Posiciones</h3>
                <p className="text-gray-700">
                  Asigna números a las letras (a=1, b=2, c=3...) para identificar patrones numéricos 
                  que pueden ser más fáciles de visualizar.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-purple-600 mb-3">3. 🔄 Busca Series Alternadas</h3>
                <p className="text-gray-700">
                  Si no encuentras un patrón único, verifica si hay dos series intercaladas 
                  siguiendo diferentes reglas.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-red-600 mb-3">4. ⏰ Practica Regularmente</h3>
                <p className="text-gray-700">
                  La velocidad es clave en oposiciones. Practica con cronómetro para mejorar 
                  tu tiempo de respuesta manteniendo la precisión.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-blue-600">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-6">
              ¿Listo para Dominar las Series de Letras?
            </h2>
            
            <p className="text-xl text-blue-100 mb-8">
              Únete a miles de opositores que ya están mejorando sus habilidades con nuestros tests gratuitos
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/psicotecnicos/test"
                className="bg-white hover:bg-gray-100 text-blue-600 font-semibold py-4 px-8 rounded-lg text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                🎯 Empezar Test Gratuito
              </Link>
              
              <Link 
                href="/psicotecnicos/test"
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                📚 Ver Todos los Tests
              </Link>
            </div>
            
            <p className="text-blue-200 mt-6">
              ✅ Sin registro • ✅ Completamente gratis • ✅ Resultados inmediatos
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Preguntas Frecuentes sobre Series de Letras
            </h2>
            
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ¿Qué son las series de letras en tests psicotécnicos?
                </h3>
                <p className="text-gray-700">
                  Las series de letras son ejercicios donde debes identificar el patrón lógico que sigue 
                  una secuencia de letras y determinar cuál sería la siguiente letra de la serie.
                </p>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ¿Cómo puedo mejorar en series de letras?
                </h3>
                <p className="text-gray-700">
                  La práctica constante es clave. Familiarízate con los patrones más comunes, practica 
                  con cronómetro y analiza tus errores para entender mejor la lógica de cada tipo de serie.
                </p>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ¿Son importantes las series de letras en oposiciones?
                </h3>
                <p className="text-gray-700">
                  Sí, especialmente en oposiciones para auxiliar administrativo, administrativo del estado 
                  y otras posiciones que requieren aptitudes de razonamiento lógico y verbal.
                </p>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ¿Cuánto tiempo debo dedicar a practicar series de letras?
                </h3>
                <p className="text-gray-700">
                  Recomendamos al menos 15-20 minutos diarios. Con práctica regular, notarás mejoras 
                  significativas en tu velocidad y precisión en pocas semanas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-12 px-4 bg-gradient-to-r from-green-600 to-blue-600">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Comienza a Practicar Series de Letras Ahora
            </h2>
            
            <p className="text-green-100 mb-6">
              No esperes más. Cada día de práctica te acerca más a tu objetivo.
            </p>
            
            <Link 
              href="/psicotecnicos/test"
              className="inline-block bg-white hover:bg-gray-100 text-blue-600 font-bold py-4 px-8 rounded-lg text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              🚀 Iniciar Test de Series de Letras Gratis
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}