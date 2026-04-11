// components/SectionFilterModal.tsx
'use client'

import { useState, useEffect } from 'react'

interface Section {
  id: string
  title: string
  description: string | null
  articleRange: { start: number; end: number } | null
  sectionNumber: number | string | null
  sectionType: string | null
  orderPosition: number
  // Sólo presente cuando se carga vía endpoint v2 (con contexto de tema).
  // Permite al modal deshabilitar secciones sin artículos en el tema actual
  // y mostrar badges informativos con el conteo de artículos en scope.
  scopeMeta?: {
    articlesInScope: string[]
    articleCountInScope: number
  }
}

interface SectionFilterModalProps {
  isOpen: boolean
  onClose: () => void
  lawSlug: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSectionSelect: (sections: any[]) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedSections?: any[]
}

export default function SectionFilterModal({
  isOpen,
  onClose,
  lawSlug,
  onSectionSelect,
  selectedSections = []
}: SectionFilterModalProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localSelectedSections, setLocalSelectedSections] = useState<Section[]>([])

  useEffect(() => {
    if (isOpen) {
      setLocalSelectedSections(selectedSections || [])
    }
  }, [isOpen, selectedSections])

  useEffect(() => {
    if (isOpen && lawSlug) {
      loadSections()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lawSlug])

  const loadSections = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/teoria/sections?law=${encodeURIComponent(lawSlug || '')}`)
      const data = await res.json()
      setSections(data.sections || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Una sección es "seleccionable" si no tiene scopeMeta (flujo legacy sin tema)
  // o si tiene al menos 1 artículo dentro del scope del tema.
  const isSectionAvailable = (section: Section): boolean => {
    if (!section.scopeMeta) return true
    return section.scopeMeta.articleCountInScope > 0
  }

  const toggleSection = (section: Section) => {
    // Ignorar clicks en secciones sin artículos en scope (deshabilitadas)
    if (!isSectionAvailable(section)) return

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
    // Sólo marcar secciones disponibles — las deshabilitadas (0 arts en scope) se ignoran
    setLocalSelectedSections(sections.filter(isSectionAvailable))
  }

  const deselectAll = () => {
    setLocalSelectedSections([])
  }

  const handleApply = () => {
    console.log('📚 SectionFilterModal - Aplicando selección:', {
      localSelectedSections,
      count: localSelectedSections.length,
      titles: localSelectedSections.map(s => s.title)
    })
    onSectionSelect(localSelectedSections)
    onClose()
  }

  const isSectionSelected = (sectionId: string) => {
    return localSelectedSections.some(s => s.id === sectionId)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      <div className="relative mx-auto max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Filtrar por Titulos
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-xl"
          >
            &#x2715;
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-600 dark:text-gray-400">Cargando titulos...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && sections.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No hay titulos disponibles para esta ley.</p>
            </div>
          )}

          {!loading && !error && sections.length > 0 && (
            <>
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
                  const isAvailable = isSectionAvailable(section)
                  const scopeCount = section.scopeMeta?.articleCountInScope ?? null

                  // Estados visuales:
                  //  - disponible + seleccionada → azul
                  //  - disponible + no seleccionada → gris con hover
                  //  - no disponible (scopeMeta 0) → gris oscuro, no clicable
                  const buttonClasses = !isAvailable
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 opacity-60 cursor-not-allowed'
                    : isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'

                  return (
                    <button
                      key={section.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => toggleSection(section)}
                      title={!isAvailable ? 'Este título no contiene artículos del tema actual' : undefined}
                      className={`w-full text-left p-4 border rounded-lg transition-all group ${buttonClasses}`}
                    >
                      <div className="flex items-start">
                        <div className={`flex-shrink-0 w-5 h-5 mt-0.5 mr-3 rounded border-2 flex items-center justify-center transition-colors ${
                          !isAvailable
                            ? 'border-gray-300 dark:border-gray-600'
                            : isSelected
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300 dark:border-gray-500'
                        }`}>
                          {isSelected && isAvailable && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className={`font-semibold mb-2 ${
                            !isAvailable
                              ? 'text-gray-500 dark:text-gray-500'
                              : isSelected
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`}>
                            {section.title}
                          </div>
                          {section.description && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {section.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {section.articleRange && (
                              <div className={`text-xs ${
                                !isAvailable
                                  ? 'text-gray-400 dark:text-gray-600'
                                  : isSelected
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-blue-600 dark:text-blue-500'
                              }`}>
                                Artículos {section.articleRange.start}-{section.articleRange.end}
                              </div>
                            )}
                            {scopeCount !== null && (
                              isAvailable ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  📌 {scopeCount} en este tema
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                  Sin artículos en este tema
                                </span>
                              )
                            )}
                          </div>
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
              {(() => {
                const availableCount = sections.filter(isSectionAvailable).length
                const hasScopedContext = sections.some(s => s.scopeMeta !== undefined)
                if (localSelectedSections.length === 0) {
                  return hasScopedContext
                    ? `Ningún título seleccionado (se usarán los ${availableCount} con artículos en este tema)`
                    : 'Ningún título seleccionado (se usarán todos)'
                }
                return `${localSelectedSections.length} título${localSelectedSections.length > 1 ? 's' : ''} seleccionado${localSelectedSections.length > 1 ? 's' : ''}`
              })()}
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
