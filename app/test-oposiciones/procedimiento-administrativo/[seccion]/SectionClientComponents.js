'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function SectionClientComponents({ sectionData }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { config } = sectionData

  useEffect(() => {
    // Por ahora mostrar mensaje de que el contenido está en desarrollo
    setQuestions([])
    setLoading(false)
  }, [])

  const testConfig = {
    name: `Test ${config.name}`,
    description: config.description,
    color: "from-teal-600 to-emerald-700",
    icon: config.icon,
    difficulty: "Medio",
    timeLimit: null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando preguntas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link 
            href="/test-oposiciones/procedimiento-administrativo"
            className="text-emerald-600 hover:text-emerald-700"
          >
            Volver a Procedimiento Administrativo
          </Link>
        </div>
      </div>
    )
  }

  // Si no hay preguntas, mostrar mensaje de desarrollo
  if (questions.length === 0) {
    return (
      <div className="bg-gray-50 min-h-screen">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-200 py-4">
          <div className="max-w-6xl mx-auto px-4">
            <nav className="flex text-sm text-gray-600">
              <Link href="/test-oposiciones" className="hover:text-blue-600">
                Tests de Oposiciones
              </Link>
              <span className="mx-2">›</span>
              <Link href="/test-oposiciones/procedimiento-administrativo" className="hover:text-blue-600">
                Procedimiento Administrativo
              </Link>
              <span className="mx-2">›</span>
              <span className="font-medium text-gray-900">
                {config.name}
              </span>
            </nav>
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white py-16">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <div className="text-7xl mb-6">{config.icon}</div>
            <h1 className="text-4xl font-bold mb-4">
              {config.name}
            </h1>
            <p className="text-emerald-100 text-xl mb-8 max-w-3xl mx-auto">
              {config.description}
            </p>
          </div>
        </div>

        {/* Contenido en desarrollo */}
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-6xl mb-6">🚧</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Contenido en Desarrollo
            </h2>
            <p className="text-gray-600 mb-8">
              Esta sección está siendo preparada con contenido específico sobre <strong>{config.name.toLowerCase()}</strong>.
              Las preguntas y material de estudio estarán disponibles próximamente.
            </p>
            
            <div className="flex justify-center gap-4">
              <Link 
                href="/test-oposiciones/procedimiento-administrativo"
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Volver a Procedimiento Administrativo
              </Link>
              <Link 
                href="/test-oposiciones"
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Ver Otros Tests
              </Link>
            </div>
          </div>

          {/* Información sobre la sección */}
          <div className="mt-8 bg-white rounded-xl shadow-md p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Sobre esta sección
            </h3>
            <p className="text-gray-600 mb-4">
              {config.description}
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="text-emerald-600 text-lg mr-3">ℹ️</div>
                <div>
                  <p className="text-emerald-800 text-sm font-medium">
                    Este contenido forma parte de la sección {config.section_number} de nuestro material de Procedimiento Administrativo
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Cuando tengamos preguntas, usaremos TestLayout
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="text-6xl mb-6">🚧</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Test en Desarrollo
          </h2>
          <p className="text-gray-600 mb-8">
            El sistema de preguntas para esta sección estará disponible próximamente.
          </p>
        </div>
      </div>
    </div>
  )
}