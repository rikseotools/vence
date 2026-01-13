// app/tramitacion-procesal/test/aleatorio/page.tsx
'use client'

import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

export default function TestAleatorioTramitacionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <InteractiveBreadcrumbs />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Icon */}
          <div className="mb-6">
            <span className="text-6xl">🚧</span>
          </div>

          {/* Header */}
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Test Aleatorio - Próximamente
          </h1>

          <p className="text-gray-600 mb-8 text-lg">
            Estamos preparando los tests aleatorios para Tramitación Procesal.
            Mientras tanto, puedes practicar con los tests por tema.
          </p>

          {/* Info Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ¿Qué estamos preparando?
            </h2>
            <ul className="text-left text-gray-600 space-y-3">
              <li className="flex items-start">
                <span className="text-purple-600 mr-2">✓</span>
                <span>Tests personalizados con selección de temas</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-600 mr-2">✓</span>
                <span>Configuración de número de preguntas y dificultad</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-600 mr-2">✓</span>
                <span>Modo práctica y modo examen</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-600 mr-2">✓</span>
                <span>Estadísticas detalladas por tema</span>
              </li>
            </ul>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/tramitacion-procesal/test"
              className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all"
            >
              <span>📚</span>
              <span>Ver Tests por Tema</span>
            </Link>
            <Link
              href="/tramitacion-procesal/temario"
              className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-3 rounded-xl font-semibold border-2 border-gray-200 transition-all"
            >
              <span>📖</span>
              <span>Ver Temario</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
