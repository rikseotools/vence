// components/SectionFilterModal.js
'use client'

import { useState, useEffect } from 'react'
import { fetchLawSections } from '@/lib/teoriaFetchers'

export default function SectionFilterModal({
  isOpen,
  onClose,
  lawSlug,
  onSectionSelect,
  selectedSections = [] // 🆕 Secciones previamente seleccionadas
}) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [localSelectedSections, setLocalSelectedSections] = useState([])

  // Inicializar con secciones previamente seleccionadas
  useEffect(() => {
    if (isOpen) {
      setLocalSelectedSections(selectedSections)
    }
  }, [isOpen, selectedSections])

  useEffect(() => {
    if (isOpen && lawSlug) {
      loadSections()
    }
  }, [isOpen, lawSlug])

  const loadSections = async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await fetchLawSections(lawSlug)
      setSections(data.sections || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section) => {
    setLocalSelectedSections(prev => {
      const isSelected = prev.some(s => s.id === section.id)
      if (isSelected) {
        return prev.filter(s => s.id !== section.id)
      } else {
        return [...prev, section]
      }
    })
  }

  const selectAll = () => {
    setLocalSelectedSections(sections)
  }

  const deselectAll = () => {
    setLocalSelectedSections([])
  }

  const handleApply = () => {
    onSectionSelect(localSelectedSections)
    onClose()
  }

  const isSectionSelected = (sectionId) => {
    return localSelectedSections.some(s => s.id === sectionId)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      <div className="relative mx-auto max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            📚 Filtrar por Títulos
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-600 dark:text-gray-400">Cargando títulos...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && sections.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No hay títulos disponibles para esta ley.</p>
            </div>
          )}

          {!loading && !error && sections.length > 0 && (
            <>
              {/* Botones de selección rápida */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  Seleccionar todos
                </button>
                <button
                  onClick={deselectAll}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Deseleccionar todos
                </button>
              </div>

              <div className="space-y-3">
                {sections.map((section) => {
                  const isSelected = isSectionSelected(section.id)
                  return (
                    <button
                      key={section.id}
                      onClick={() => toggleSection(section)}
                      className={`w-full text-left p-4 border rounded-lg transition-all group ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <div className="flex items-start">
                        {/* Checkbox visual */}
                        <div className={`flex-shrink-0 w-5 h-5 mt-0.5 mr-3 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300 dark:border-gray-500'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className={`font-semibold mb-2 ${
                            isSelected
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`}>
                            {section.title}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {section.description}
                          </div>
                          {section.articleRange && (
                            <div className={`text-xs ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-blue-600 dark:text-blue-500'}`}>
                              Artículos {section.articleRange.start}-{section.articleRange.end}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {localSelectedSections.length === 0
                ? 'Ningún título seleccionado (se usarán todos)'
                : `${localSelectedSections.length} título${localSelectedSections.length > 1 ? 's' : ''} seleccionado${localSelectedSections.length > 1 ? 's' : ''}`
              }
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Aplicar filtro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
