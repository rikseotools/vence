// components/Admin/DataIntegrityTab.js
'use client'

import { useState, useEffect } from 'react'

// Configuración oficial de leyes según BOE
// IMPORTANTE: Actualizar cuando cambien las leyes
const LEYES_OFICIALES = {
  'RDL 5/2015': {
    nombre: 'Estatuto Básico del Empleado Público (EBEP)',
    articuloMax: 100,
    articulosEspeciales: ['47bis'],
    articulosProhibidos: ['101', '149'],
  },
  'CE': {
    nombre: 'Constitución Española',
    articuloMax: 169,
    articulosEspeciales: [],
    articulosProhibidos: [],
  },
  'Ley 39/2015': {
    nombre: 'Ley del Procedimiento Administrativo Común',
    articuloMax: 133,
    articulosEspeciales: [],
    articulosProhibidos: [],
  },
  'Ley 40/2015': {
    nombre: 'Ley de Régimen Jurídico del Sector Público',
    articuloMax: 158,
    articulosEspeciales: [],
    articulosProhibidos: [],
  },
}

const Spinner = ({ size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <div className={`animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 ${sizeClasses[size]}`} />
  )
}

export default function DataIntegrityTab() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [lastCheck, setLastCheck] = useState(null)

  // Ejecutar validación
  const runValidation = async () => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/data-integrity/validate')
      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Error ejecutando validación')
        return
      }

      setResults(data)
      setLastCheck(new Date().toISOString())
    } catch (err) {
      setError('Error conectando con el servidor')
    } finally {
      setLoading(false)
    }
  }

  // Cargar resultados al iniciar
  useEffect(() => {
    // Cargar resultados previos si los hay
    const loadCachedResults = async () => {
      try {
        const response = await fetch('/api/data-integrity/validate?cached=true')
        const data = await response.json()
        if (data.success && data.results) {
          setResults(data)
          setLastCheck(data.lastCheck)
        }
      } catch (err) {
        // Silenciar errores de carga inicial
      }
    }
    loadCachedResults()
  }, [])

  const totalErrors = results?.summary?.totalErrors || 0
  const totalWarnings = results?.summary?.totalWarnings || 0

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            🔍 Validación de Integridad de Datos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            Detecta errores y discrepancias en los datos de leyes
          </p>
        </div>

        <button
          onClick={runValidation}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors text-sm sm:text-base flex items-center justify-center space-x-2"
        >
          {loading && <Spinner size="sm" />}
          <span>{loading ? 'Validando...' : 'Ejecutar validación'}</span>
        </button>
      </div>

      {/* Indicador de carga */}
      {loading && (
        <div className="mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Spinner size="md" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Validando integridad de datos...
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 mb-6">
          <p className="text-red-600 dark:text-red-400 text-sm sm:text-base">{error}</p>
        </div>
      )}

      {lastCheck && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 mb-6">
          <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">
            Última verificación: {new Date(lastCheck).toLocaleString('es-ES')}
          </p>
        </div>
      )}

      {/* Resumen general */}
      {results && !loading && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`rounded-lg p-4 border ${
            totalErrors === 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="text-2xl font-bold">
              {totalErrors === 0 ? '✅' : '❌'} {totalErrors}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Errores críticos
            </div>
          </div>

          <div className={`rounded-lg p-4 border ${
            totalWarnings === 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          }`}>
            <div className="text-2xl font-bold">
              {totalWarnings === 0 ? '✅' : '⚠️'} {totalWarnings}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Advertencias
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="text-2xl font-bold">
              📋 {results?.summary?.lawsChecked || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Leyes verificadas
            </div>
          </div>
        </div>
      )}

      {/* Resultados por ley */}
      {results?.lawResults && !loading && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Detalle por ley
          </h2>

          {results.lawResults.map((law) => (
            <div
              key={law.shortName}
              className={`rounded-lg border p-4 ${
                law.errors.length > 0
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : law.warnings.length > 0
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {law.errors.length === 0 && law.warnings.length === 0 ? '✅' : law.errors.length > 0 ? '❌' : '⚠️'} {law.shortName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {law.nombre}
                  </p>
                </div>
                <div className="flex gap-2">
                  {law.errors.length > 0 && (
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 text-xs rounded-full">
                      {law.errors.length} error(es)
                    </span>
                  )}
                  {law.warnings.length > 0 && (
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 text-xs rounded-full">
                      {law.warnings.length} advertencia(s)
                    </span>
                  )}
                </div>
              </div>

              {/* Errores */}
              {law.errors.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Errores:</h4>
                  <ul className="space-y-1">
                    {law.errors.map((err, i) => (
                      <li key={i} className="text-sm text-red-700 dark:text-red-300 pl-4 relative">
                        <span className="absolute left-0">•</span>
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Advertencias */}
              {law.warnings.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Advertencias:</h4>
                  <ul className="space-y-1">
                    {law.warnings.map((warn, i) => (
                      <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300 pl-4 relative">
                        <span className="absolute left-0">•</span>
                        {warn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Info de stats */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <span>Total artículos: {law.stats?.totalArticles || 0}</span>
                  <span>Activos: {law.stats?.activeArticles || 0}</span>
                  {law.stats?.topicScopeCount && (
                    <span>Topic scopes: {law.stats.topicScopeCount}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Validaciones de topic_scope */}
      {results?.topicScopeErrors && results.topicScopeErrors.length > 0 && !loading && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ⚠️ Errores de Topic Scope
          </h2>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <ul className="space-y-2">
              {results.topicScopeErrors.map((err, i) => (
                <li key={i} className="text-sm text-orange-700 dark:text-orange-300">
                  • {err}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Info de configuración */}
      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
          ℹ️ Configuración de validación
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Las validaciones se basan en la configuración oficial de cada ley según el BOE:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {Object.entries(LEYES_OFICIALES).map(([key, config]) => (
            <div key={key} className="bg-white dark:bg-gray-700 p-2 rounded">
              <span className="font-medium text-gray-900 dark:text-white">{key}</span>
              <span className="text-gray-500 dark:text-gray-400"> - máx. art. {config.articuloMax}</span>
              {config.articulosProhibidos.length > 0 && (
                <span className="text-red-500 dark:text-red-400 ml-1">
                  (prohibidos: {config.articulosProhibidos.join(', ')})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Instrucciones si no hay resultados */}
      {!results && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No hay resultados de validación
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Haz clic en "Ejecutar validación" para verificar la integridad de los datos
          </p>
        </div>
      )}
    </div>
  )
}
