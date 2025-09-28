// app/es/auxiliar-administrativo-estado/temario/tema-3/page.js - TEMA 3: LAS CORTES GENERALES
import { Suspense } from 'react'
import { Metadata } from 'next'
import Tema3Interactive from './Tema3Interactive'

// Metadata para SEO
export const metadata = {
  title: 'Tema 3: Las Cortes Generales - Auxiliar Administrativo Estado | ILoveTest',
  description: 'Tema 3 completo sobre Las Cortes Generales: composición del Congreso y Senado, atribuciones, funcionamiento y el Defensor del Pueblo. Temario oficial Auxiliar Administrativo del Estado.',
  keywords: [
    'Cortes Generales',
    'Congreso de los Diputados', 
    'Senado',
    'Defensor del Pueblo',
    'legislativo',
    'parlamentario',
    'Auxiliar Administrativo Estado',
    'temario oficial',
    'oposiciones'
  ],
  openGraph: {
    title: 'Tema 3: Las Cortes Generales - Auxiliar Administrativo Estado',
    description: 'Estudio completo de las Cortes Generales: composición, atribuciones, funcionamiento del Congreso y Senado, y el Defensor del Pueblo.',
    type: 'article',
  }
}

// Componente de carga
function LoadingTema() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando Tema 3: Las Cortes Generales...</p>
      </div>
    </div>
  )
}

export default function Tema3Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <a href="/es" className="hover:text-blue-600 transition-colors">Inicio</a>
            <span>›</span>
            <a href="/es/auxiliar-administrativo-estado" className="hover:text-blue-600 transition-colors">
              Auxiliar Administrativo del Estado
            </a>
            <span>›</span>
            <a href="/es/auxiliar-administrativo-estado/temario" className="hover:text-blue-600 transition-colors">
              Temario
            </a>
            <span>›</span>
            <span className="text-gray-900 font-medium">Tema 3: Las Cortes Generales</span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white bg-opacity-20 rounded-full mb-6">
            <span className="text-3xl">🏛️</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Tema 3: Las Cortes Generales
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
            Composición, atribuciones y funcionamiento del Congreso de los Diputados y del Senado. El Defensor del Pueblo.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <div className="bg-white bg-opacity-20 rounded-lg px-6 py-3">
              <div className="text-2xl font-bold">350</div>
              <div className="text-sm text-blue-100">Diputados</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg px-6 py-3">
              <div className="text-2xl font-bold">266</div>
              <div className="text-sm text-blue-100">Senadores</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg px-6 py-3">
              <div className="text-2xl font-bold">4</div>
              <div className="text-sm text-blue-100">Años mandato</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <Suspense fallback={<LoadingTema />}>
        <Tema3Interactive />
      </Suspense>

      {/* FAQ Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            Preguntas Frecuentes - Tema 3
          </h2>
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                ¿Cuántos diputados tiene el Congreso?
              </h3>
              <p className="text-gray-600">
                Entre 300 y 400 diputados según el art. 68.1 CE. Actualmente son 350 diputados elegidos por 4 años mediante sufragio universal, libre, igual, directo y secreto.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                ¿Cómo se elige el Defensor del Pueblo?
              </h3>
              <p className="text-gray-600">
                Es elegido por las Cortes Generales por mayoría de 3/5 de cada Cámara para un período de 5 años. Si no se alcanza la mayoría, se constituye una Comisión Mixta paritaria.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                ¿Cuáles son los períodos de sesiones de las Cortes?
              </h3>
              <p className="text-gray-600">
                Dos períodos ordinarios: de septiembre a diciembre y de febrero a junio. También pueden reunirse en sesiones extraordinarias.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                ¿Qué son las prerrogativas parlamentarias?
              </h3>
              <p className="text-gray-600">
                Inviolabilidad por opiniones en el ejercicio de funciones e inmunidad (solo detención en flagrante delito). Competencia del Tribunal Supremo (Sala Penal).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}