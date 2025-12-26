'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { getCanonicalSlug } from '../lib/lawMappingUtils'

// Detectar si una ley es virtual (sin artículos legales reales)
function isVirtualLaw(law) {
  return law.description?.toLowerCase().includes('ficticia') ||
         law.description?.toLowerCase().includes('virtual')
}

// Videos disponibles para leyes virtuales
const VIRTUAL_LAW_VIDEOS = {
  'Windows 11': 'https://www.youtube.com/watch?v=RuYQ8EqwV4U',
  'Procesadores de texto': 'https://www.youtube.com/watch?v=zneo5Ys7z-E',
  'Informática Básica': 'https://www.youtube.com/watch?v=PvMTv5GncMM',
  'Correo electrónico': 'https://www.youtube.com/watch?v=Tfcug4zeiPw',
  'Hojas de cálculo. Excel': 'https://www.youtube.com/watch?v=7fmgMflwUXA',
  'Base de datos: Access': 'https://www.youtube.com/watch?v=X39ZNkBnepM',
}

export default function LeyesClientWrapper({ laws }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'legal', 'virtual'

  // Filtrar y ordenar leyes según búsqueda y tipo
  const filteredLaws = useMemo(() => {
    const filtered = laws.filter(law => {
      // Filtro de búsqueda
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm ||
        law.name?.toLowerCase().includes(searchLower) ||
        law.short_name?.toLowerCase().includes(searchLower) ||
        law.description?.toLowerCase().includes(searchLower)

      // Filtro de tipo
      const isVirtual = isVirtualLaw(law)
      const matchesType = filterType === 'all' ||
        (filterType === 'legal' && !isVirtual) ||
        (filterType === 'virtual' && isVirtual)

      return matchesSearch && matchesType
    })

    // Ordenar: leyes normales primero (por preguntas), virtuales al final
    return filtered.sort((a, b) => {
      const aVirtual = isVirtualLaw(a)
      const bVirtual = isVirtualLaw(b)

      // Si uno es virtual y otro no, el no-virtual va primero
      if (aVirtual && !bVirtual) return 1
      if (!aVirtual && bVirtual) return -1

      // Dentro del mismo tipo, ordenar por número de preguntas
      return (b.questionCount || 0) - (a.questionCount || 0)
    })
  }, [laws, searchTerm, filterType])

  // Contar leyes por tipo
  const virtualCount = laws.filter(isVirtualLaw).length
  const legalCount = laws.length - virtualCount

  return (
    <section className="mb-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Test de Leyes Disponibles
        </h2>
        <p className="text-xl text-gray-600">
          Elige la ley que quieres estudiar y comienza a practicar
        </p>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="mb-8 bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Campo de búsqueda */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar ley... (ej: Constitución, LPAC, Windows)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filtros por tipo */}
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas ({laws.length})
            </button>
            <button
              onClick={() => setFilterType('legal')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'legal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Leyes ({legalCount})
            </button>
            <button
              onClick={() => setFilterType('virtual')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'virtual'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Informática ({virtualCount})
            </button>
          </div>
        </div>

        {/* Indicador de resultados */}
        {(searchTerm || filterType !== 'all') && (
          <div className="mt-4 text-sm text-gray-600">
            Mostrando {filteredLaws.length} de {laws.length} leyes
            {searchTerm && <span> para "<strong>{searchTerm}</strong>"</span>}
          </div>
        )}
      </div>

      {/* Grid de leyes */}
      {filteredLaws.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLaws.map((law) => {
            const canonicalSlug = getCanonicalSlug(law.short_name)
            const isVirtual = isVirtualLaw(law)

            return (
              <div
                key={law.id}
                className="group block"
              >
                <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border hover:border-blue-200">

                  {/* Header colorido */}
                  <div className={`p-6 text-white ${
                    isVirtual
                      ? 'bg-gradient-to-r from-red-500 to-pink-600'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold mb-2 group-hover:text-blue-100 transition-colors">
                          {law.short_name}
                        </h3>
                        <div className="flex items-center space-x-4 text-blue-100">
                          <span className="text-sm">
                            {law.questionCount} preguntas
                          </span>
                          {law.officialQuestions > 0 && (
                            <span className="text-sm">
                              {law.officialQuestions} oficiales
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-3xl opacity-70">
                        {isVirtual ? '🎥' : '⚡'}
                      </div>
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="p-6">
                    <h4 className="font-semibold text-gray-800 mb-3 line-clamp-2">
                      {law.name}
                    </h4>

                    {law.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {law.description}
                      </p>
                    )}

                    {/* Botones de acción */}
                    <div className="space-y-3">
                      {/* Botón de test */}
                      <Link
                        href={`/leyes/${canonicalSlug}`}
                        className={`block text-white text-center py-3 px-4 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg ${
                          isVirtual
                            ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                        }`}
                      >
                        Test {law.short_name}
                      </Link>

                      {/* Enlace a teoría o video según tipo de ley */}
                      {isVirtual && VIRTUAL_LAW_VIDEOS[law.short_name] ? (
                        <Link
                          href={`/teoria/${canonicalSlug}`}
                          className="block bg-red-50 text-red-700 text-center py-2 px-3 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                        >
                          Ver Video
                        </Link>
                      ) : !isVirtual && (
                        <Link
                          href={`/teoria/${canonicalSlug}`}
                          className="block bg-gray-50 text-gray-700 text-center py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                        >
                          Ver Teoría y Artículos
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            No se encontraron leyes
          </h3>
          <p className="text-gray-600 mb-4">
            No hay leyes que coincidan con tu búsqueda "{searchTerm}"
          </p>
          <button
            onClick={() => { setSearchTerm(''); setFilterType('all'); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Estadísticas generales */}
      <div className="mt-12 bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            Estadísticas Generales
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {laws.length}
            </div>
            <div className="text-gray-600 text-sm">Leyes Disponibles</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {laws.reduce((sum, law) => sum + law.questionCount, 0).toLocaleString()}
            </div>
            <div className="text-gray-600 text-sm">Total Preguntas</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {laws.reduce((sum, law) => sum + law.officialQuestions, 0).toLocaleString()}
            </div>
            <div className="text-gray-600 text-sm">Preguntas Oficiales</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">100%</div>
            <div className="text-gray-600 text-sm">Gratis</div>
          </div>
        </div>
      </div>

      {/* Información SEO adicional */}
      <div className="mt-16 bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">
          Todo sobre los Test de Leyes en España
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">¿Qué son los Test de Leyes?</h3>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Los <strong>test de leyes</strong> son cuestionarios especializados que evalúan el conocimiento
              de la legislación española. Son fundamentales para la preparación de oposiciones,
              estudios de derecho y actualización profesional.
            </p>
            <p className="text-gray-600 mb-4 leading-relaxed">
              En <strong>Vence</strong> encontrarás tests de las leyes más importantes de España,
              desde la Constitución hasta códigos especializados, todos actualizados y gratuitos.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Ventajas de Practicar Online</h3>
            <ul className="text-gray-600 space-y-2">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <strong>Acceso 24/7</strong> desde cualquier dispositivo
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <strong>Contenido actualizado</strong> con las últimas reformas
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <strong>Explicaciones detalladas</strong> de cada respuesta
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <strong>Seguimiento del progreso</strong> y estadísticas
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <strong>Totalmente gratuito</strong> sin restricciones
              </li>
            </ul>
          </div>
        </div>

        {/* Información sobre rendimiento */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-sm text-green-700">
              <span className="font-semibold">⚡ Página optimizada:</span>
              Los datos se cachean por 30 días para garantizar carga ultrarrápida. Un usuario regenera el cache para todos.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
