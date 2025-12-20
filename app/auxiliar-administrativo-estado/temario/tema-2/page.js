// app/auxiliar-administrativo-estado/temario/tema-2/page.js
import { Suspense } from 'react'
import { Metadata } from 'next'
import Tema2Interactive from './Tema2Interactive'

// Metadatos SEO optimizados
export const metadata = {
  title: 'Tema 2: El Tribunal Constitucional - Temario Auxiliar Administrativo Estado',
  description: 'Estudia el Tema 2 del temario oficial: El Tribunal Constitucional. Composición, competencias, procedimientos y funcionamiento. Material actualizado 2025.',
  keywords: 'Tribunal Constitucional, auxiliar administrativo, oposiciones, temario oficial, competencias constitucionales, procedimientos constitucionales',
  openGraph: {
    title: 'Tema 2: El Tribunal Constitucional',
    description: 'Material completo del Tema 2 para Auxiliar Administrativo del Estado',
    type: 'article'
  }
}

// Datos estructurados para SEO
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "Tema 2: El Tribunal Constitucional",
  "description": "Tema completo sobre el Tribunal Constitucional para oposiciones de Auxiliar Administrativo del Estado",
  "provider": {
    "@type": "Organization",
    "name": "Vence"
  },
  "courseCode": "Tema 2",
  "educationalLevel": "Professional",
  "inLanguage": "es-ES",
  "teaches": [
    "Composición del Tribunal Constitucional",
    "Competencias constitucionales",
    "Procedimientos ante el Tribunal",
    "Funcionamiento institucional"
  ]
}

export default function Tema2Page() {
  return (
    <>
      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="container mx-auto px-4 py-8">
          
          {/* Breadcrumb */}
          <nav className="mb-6">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <a href="/es" className="hover:text-red-600">Inicio</a>
              <span>›</span>
              <a href="/auxiliar-administrativo-estado" className="hover:text-red-600">Auxiliar Administrativo</a>
              <span>›</span>
              <a href="/auxiliar-administrativo-estado/temario" className="hover:text-red-600">Temario</a>
              <span>›</span>
              <span className="font-medium text-red-700">Tema 2</span>
            </div>
          </nav>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-full text-lg font-bold mb-4">
              <span className="mr-2">⚖️</span>
              Tema 2
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              El Tribunal Constitucional
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Composición, competencias, procedimientos y funcionamiento del Tribunal Constitucional.
              Material oficial actualizado 2025.
            </p>
          </div>

          {/* Componente Interactivo */}
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          }>
            <Tema2Interactive />
          </Suspense>

          {/* FAQ Section */}
          <section className="mt-16 mb-12">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                ❓ Preguntas Frecuentes - Tema 2
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2">¿Cuántos magistrados tiene el Tribunal Constitucional?</h3>
                    <p className="text-gray-600 text-sm">
                      El Tribunal Constitucional está compuesto por 12 magistrados nombrados por el Rey.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2">¿Cuál es su competencia principal?</h3>
                    <p className="text-gray-600 text-sm">
                      Su función principal es la interpretación suprema de la Constitución y el control de constitucionalidad.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2">¿Qué tipos de recursos conoce?</h3>
                    <p className="text-gray-600 text-sm">
                      Recursos de inconstitucionalidad, cuestiones de inconstitucionalidad, recursos de amparo y conflictos de competencia.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2">¿Cuánto dura el mandato?</h3>
                    <p className="text-gray-600 text-sm">
                      Los magistrados son nombrados por un periodo de 9 años, renovándose por terceras partes cada 3 años.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}