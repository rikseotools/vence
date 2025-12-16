'use client'
import { useState, useEffect } from 'react'

export default function LoadingQuestionsIndicator({
  themes = [],
  filters = {}
}) {
  const [currentThemeIndex, setCurrentThemeIndex] = useState(0)
  const [dots, setDots] = useState('')

  // Animación de puntos
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)
    return () => clearInterval(dotsInterval)
  }, [])

  // Animación de temas (rotar por los temas seleccionados)
  useEffect(() => {
    if (themes.length > 0) {
      const themeInterval = setInterval(() => {
        setCurrentThemeIndex(prev => (prev + 1) % themes.length)
      }, 800)
      return () => clearInterval(themeInterval)
    }
  }, [themes.length])

  const themeNames = {
    1: "Constitución",
    2: "Tribunal Constitucional",
    3: "Cortes Generales",
    4: "Poder Judicial",
    5: "Gobierno",
    6: "Gobierno Abierto",
    7: "Transparencia",
    8: "AGE",
    9: "Organización Territorial",
    10: "Unión Europea",
    11: "Procedimiento Administrativo",
    12: "Protección de Datos",
    13: "Personal Funcionario",
    14: "Derechos y Deberes",
    15: "Presupuesto",
    16: "Políticas de Igualdad"
  }

  const activeFilters = []
  if (filters.onlyOfficialQuestions) activeFilters.push('Oficiales')
  if (filters.focusEssentialArticles) activeFilters.push('Imprescindibles')
  if (filters.difficulty && filters.difficulty !== 'mixed') activeFilters.push(`Dificultad: ${filters.difficulty}`)
  if (filters.adaptiveMode) activeFilters.push('Modo adaptativo')

  return (
    <div className="space-y-4">
      {/* Spinner principal */}
      <div className="flex items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <div className="text-left">
          <h4 className="font-semibold text-gray-800">
            Verificando disponibilidad{dots}
          </h4>
          {themes.length > 0 && (
            <p className="text-sm text-gray-600">
              Analizando: <span className="font-medium text-blue-600">
                {themeNames[themes[currentThemeIndex]] || `Tema ${themes[currentThemeIndex]}`}
              </span>
              {themes.length > 1 && (
                <span className="text-gray-500 ml-1">
                  ({currentThemeIndex + 1}/{themes.length})
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Detalles de la búsqueda */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        {/* Temas seleccionados */}
        {themes.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 mt-0.5">Temas:</span>
            <div className="flex flex-wrap gap-1">
              {themes.slice(0, 3).map(themeId => (
                <span
                  key={themeId}
                  className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                >
                  {themeNames[themeId]}
                </span>
              ))}
              {themes.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  +{themes.length - 3} más
                </span>
              )}
            </div>
          </div>
        )}

        {/* Filtros activos */}
        {activeFilters.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 mt-0.5">Filtros:</span>
            <div className="flex flex-wrap gap-1">
              {activeFilters.map((filter, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full"
                >
                  {filter}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Barra de progreso basada en temas procesados */}
        {themes.length > 0 && (
          <div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${((currentThemeIndex + 1) / themes.length) * 100}%`
                }}
              />
            </div>
            <p className="text-xs text-center text-gray-500 mt-1">
              Procesando {themes.length} tema{themes.length !== 1 ? 's' : ''}...
            </p>
          </div>
        )}
      </div>

      {/* Mensaje informativo */}
      <p className="text-xs text-center text-gray-500 italic">
        {themes.length > 10
          ? 'Analizando múltiples temas, esto puede tardar unos segundos...'
          : activeFilters.length > 0
          ? 'Aplicando filtros especiales...'
          : 'Verificando preguntas disponibles...'}
      </p>
    </div>
  )
}