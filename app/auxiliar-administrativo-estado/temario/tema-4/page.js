// app/auxiliar-administrativo-estado/temario/tema-4/page.js - TEMA 4: EL PODER JUDICIAL
import { Suspense } from 'react'
import { Metadata } from 'next'
import Tema4Interactive from './Tema4Interactive'

// Metadata para SEO
export const metadata = {
  title: 'Tema 4: El Poder Judicial - Auxiliar Administrativo Estado | ILoveTest',
  description: 'Tema 4 completo del Poder Judicial: Tribunal Supremo, CGPJ, Ministerio Fiscal, organización judicial y Ley Orgánica 1/2025. Temario actualizado Auxiliar Administrativo del Estado.',
  keywords: [
    'Poder Judicial',
    'Tribunal Supremo',
    'CGPJ',
    'Consejo General Poder Judicial', 
    'Ministerio Fiscal',
    'Audiencia Nacional',
    'Tribunales Superiores',
    'Ley Orgánica 1/2025',
    'Auxiliar Administrativo Estado',
    'temario oficial',
    'oposiciones'
  ],
  openGraph: {
    title: 'Tema 4: El Poder Judicial - Auxiliar Administrativo Estado',
    description: 'Estudio completo del Poder Judicial: organización, competencias, CGPJ, Ministerio Fiscal y novedades Ley Orgánica 1/2025.',
    type: 'article',
  }
}

// Componente de carga
function LoadingTema() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando Tema 4: El Poder Judicial...</p>
      </div>
    </div>
  )
}

export default function Tema4Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <a href="/es" className="hover:text-amber-600 transition-colors">Inicio</a>
            <span>›</span>
            <a href="/auxiliar-administrativo-estado" className="hover:text-amber-600 transition-colors">
              Auxiliar Administrativo del Estado
            </a>
            <span>›</span>
            <a href="/auxiliar-administrativo-estado/temario" className="hover:text-amber-600 transition-colors">
              Temario
            </a>
            <span>›</span>
            <span className="text-gray-900 font-medium">Tema 4: El Poder Judicial</span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white bg-opacity-20 rounded-full mb-6">
            <span className="text-3xl">⚖️</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Tema 4: El Poder Judicial
          </h1>
          <p className="text-xl text-amber-100 max-w-3xl mx-auto leading-relaxed">
            Organización judicial: Tribunal Supremo, CGPJ, Ministerio Fiscal y actualizaciones Ley Orgánica 1/2025
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <div className="bg-white bg-opacity-20 rounded-lg px-6 py-3">
              <div className="text-2xl font-bold">5</div>
              <div className="text-sm text-amber-100">Salas TS</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg px-6 py-3">
              <div className="text-2xl font-bold">21</div>
              <div className="text-sm text-amber-100">Miembros CGPJ</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg px-6 py-3">
              <div className="text-2xl font-bold">2025</div>
              <div className="text-sm text-amber-100">Nueva LO 1/2025</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <Suspense fallback={<LoadingTema />}>
        <Tema4Interactive />
      </Suspense>

      {/* FAQ Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            Preguntas Frecuentes - Tema 4
          </h2>
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                ¿Cómo se compone el Consejo General del Poder Judicial?
              </h3>
              <p className="text-gray-600">
                21 miembros: Presidente del TS (que lo preside) + 20 vocales. De estos 20: 12 jueces/magistrados y 8 juristas, elegidos por 3/5 de cada Cámara por 5 años.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                ¿Cuáles son las 5 salas del Tribunal Supremo?
              </h3>
              <p className="text-gray-600">
                Primera (Civil), Segunda (Penal), Tercera (Contencioso-administrativo), Cuarta (Social) y Quinta (Militar).
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                ¿Cómo se nombra el Fiscal General del Estado?
              </h3>
              <p className="text-gray-600">
                Por el Rey, a propuesta del Gobierno, oído el Consejo General del Poder Judicial. Cesa con la renovación del Gobierno.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                ¿Qué novedades introduce la Ley Orgánica 1/2025?
              </h3>
              <p className="text-gray-600">
                Actualiza la organización de los Tribunales de Instancia, crea nuevas secciones especializadas (Violencia contra Infancia, Familia) y reorganiza competencias territoriales.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}