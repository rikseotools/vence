'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import type {
  PsychometricCategory,
  PsychometricSection,
  GetPsychometricCategoriesResponse,
} from '@/lib/api/psychometric-test-data/schemas'

export default function PsicotecnicosTestClient() {
  const { loading } = useAuth() as { loading: boolean }
  const router = useRouter()

  // Data from API
  const [categories, setCategories] = useState<PsychometricCategory[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // Selection state — keyed by category key
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({})
  // Section selection — keyed by section key
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>({})
  // Expanded categories (accordion)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const [numQuestionsPsico, setNumQuestionsPsico] = useState(25)

  // Load categories from API on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/psychometric-test-data')
        const data: GetPsychometricCategoriesResponse = await res.json()

        if (!data.success || !data.categories) {
          console.error('Error loading psychometric categories:', data.error)
          return
        }

        setCategories(data.categories)

        // Initialize all categories and sections as selected
        const catSelection: Record<string, boolean> = {}
        const secSelection: Record<string, boolean> = {}
        for (const cat of data.categories) {
          catSelection[cat.key] = cat.questionCount > 0
          for (const sec of cat.sections) {
            secSelection[sec.key] = true
          }
        }
        setSelectedCategories(catSelection)
        setSelectedSections(secSelection)
        setDataLoaded(true)
      } catch (err) {
        console.error('Error fetching psychometric categories:', err)
      }
    }

    loadCategories()
  }, [])

  // Helper: count of selected sections for a category
  const getSelectedSectionsCount = (cat: PsychometricCategory): number => {
    return cat.sections.filter((s: PsychometricSection) => selectedSections[s.key]).length
  }

  // Helper: total question count for selected categories/sections
  const getSelectedCategoriesQuestionCount = (): number => {
    return categories.reduce((total: number, cat: PsychometricCategory) => {
      if (!selectedCategories[cat.key]) return total
      const sectionSum = cat.sections.reduce((sub: number, sec: PsychometricSection) => {
        if (selectedSections[sec.key]) return sub + sec.count
        return sub
      }, 0)
      return total + sectionSum
    }, 0)
  }

  // Toggle all sections in a category
  const toggleCategory = (catKey: string) => {
    const cat = categories.find(c => c.key === catKey)
    if (!cat) return

    const allSelected = cat.sections.every((s: PsychometricSection) => selectedSections[s.key])

    const newSections = { ...selectedSections }
    cat.sections.forEach((s: PsychometricSection) => {
      newSections[s.key] = !allSelected
    })
    setSelectedSections(newSections)
    setSelectedCategories(prev => ({ ...prev, [catKey]: !allSelected }))
  }

  // Toggle a single section (and sync parent category state)
  const toggleSection = (sectionKey: string, catKey: string) => {
    setSelectedSections(prev => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] }
      // Sync parent: category is selected if ANY section is selected
      const cat = categories.find(c => c.key === catKey)
      if (cat) {
        const anySelected = cat.sections.some(s => next[s.key])
        setSelectedCategories(prevCat => ({ ...prevCat, [catKey]: anySelected }))
      }
      return next
    })
  }

  // Toggle accordion expand/collapse
  const toggleExpand = (catKey: string) => {
    setExpandedCategories(prev => ({ ...prev, [catKey]: !prev[catKey] }))
  }

  // Selection summary text
  const getSelectionText = (): string => {
    const totalQuestions = getSelectedCategoriesQuestionCount()
    const selectedCount = Object.values(selectedCategories).filter(Boolean).length

    if (selectedCount === 0) {
      return "Selecciona al menos una categoría para empezar"
    }

    return `${selectedCount} categoría${selectedCount !== 1 ? 's' : ''} seleccionada${selectedCount !== 1 ? 's' : ''} • ${totalQuestions} preguntas disponibles`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const totalSelectedQuestions = getSelectedCategoriesQuestionCount()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <InteractiveBreadcrumbs />

      <div className="py-8">
        <div className="max-w-6xl mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Tests Psicotécnicos
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto mb-4">
            Selecciona las categorías que quieres practicar y configura tu test personalizado
          </p>
        </div>

        {/* Loading state */}
        {!dataLoaded && (
          <div className="max-w-2xl mx-auto px-4 mb-8 text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Cargando categorías...</p>
          </div>
        )}

        {/* Category tree */}
        {dataLoaded && (
          <div className="max-w-2xl mx-auto px-4 mb-8">
            {/* Select all / Deselect all toggle */}
            {(() => {
              const allSelected = categories
                .filter(cat => cat.questionCount > 0)
                .every(cat => selectedCategories[cat.key])
              return (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => {
                      const catSel: Record<string, boolean> = {}
                      const secSel: Record<string, boolean> = {}
                      for (const cat of categories) {
                        catSel[cat.key] = allSelected ? false : cat.questionCount > 0
                        for (const sec of cat.sections) {
                          secSel[sec.key] = !allSelected
                        }
                      }
                      setSelectedCategories(catSel)
                      setSelectedSections(secSel)
                    }}
                    className={`text-sm font-medium ${allSelected ? 'text-gray-500 hover:text-gray-700' : 'text-blue-600 hover:text-blue-800'}`}
                  >
                    {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                </div>
              )
            })()}
            <div className="space-y-2">
              {categories
                .filter(cat => cat.questionCount > 0)
                .map((cat) => {
                  const visibleSections = cat.sections.filter((s: PsychometricSection) => s.count > 0)
                  const hasSections = visibleSections.length > 1
                  const isExpanded = expandedCategories[cat.key] || false
                  const selectedSectionsCount = visibleSections.filter((s: PsychometricSection) => selectedSections[s.key]).length
                  const allSectionsSelected = selectedSectionsCount === visibleSections.length
                  const someSectionsSelected = selectedSectionsCount > 0 && !allSectionsSelected

                  return (
                    <div key={cat.key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      {/* Category row */}
                      <div className="flex items-center p-3 sm:p-4">
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 border-2 rounded mr-3 flex-shrink-0 cursor-pointer flex items-center justify-center ${
                            selectedCategories[cat.key]
                              ? someSectionsSelected
                                ? 'bg-blue-400 border-blue-400'
                                : 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}
                          onClick={() => toggleCategory(cat.key)}
                        >
                          {selectedCategories[cat.key] && (
                            someSectionsSelected ? (
                              <div className="w-2.5 h-0.5 bg-white rounded" />
                            ) : (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )
                          )}
                        </div>

                        {/* Name + info (clickable to expand if has sections) */}
                        <div
                          className={`flex-1 flex items-center justify-between min-w-0 ${hasSections ? 'cursor-pointer' : ''}`}
                          onClick={() => hasSections && toggleExpand(cat.key)}
                        >
                          <span className="text-base sm:text-lg font-medium text-gray-900 truncate">
                            {cat.name}
                          </span>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            <span className="text-sm text-gray-500">
                              {hasSections
                                ? `${selectedSectionsCount}/${visibleSections.length} subcategorías • ${cat.questionCount}`
                                : `${cat.questionCount}`
                              }
                            </span>
                            {hasSections && (
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sections accordion */}
                      {hasSections && isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50/50">
                          {cat.sections.filter((s: PsychometricSection) => s.count > 0).map((section: PsychometricSection) => (
                            <label
                              key={section.key}
                              className="flex items-center justify-between px-4 py-2.5 pl-12 cursor-pointer hover:bg-gray-100/70 transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={selectedSections[section.key] || false}
                                  onChange={() => toggleSection(section.key, cat.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className={`text-sm ${section.count === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                                  {section.name}
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                section.count === 0
                                  ? 'bg-gray-100 text-gray-400'
                                  : 'bg-blue-50 text-blue-600'
                              }`}>
                                {section.count}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Test configuration */}
        {dataLoaded && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configuración del test
            </h3>

            <div className="space-y-6">
              {/* Number of questions */}
              <div className="text-center">
                <div className="text-lg font-medium text-gray-900 mb-4">Número de preguntas</div>
                <div className="flex gap-2 justify-center">
                  {[10, 25, 50, 100].map((num) => {
                    const isDisabled = totalSelectedQuestions < num
                    return (
                      <button
                        key={num}
                        onClick={() => !isDisabled && setNumQuestionsPsico(num)}
                        disabled={isDisabled}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                          numQuestionsPsico === num
                            ? 'bg-blue-600 text-white'
                            : isDisabled
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        title={isDisabled ? `Solo hay ${totalSelectedQuestions} preguntas disponibles` : ''}
                      >
                        {num}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Start test button */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white text-center">
                <p className="mb-4 text-sm opacity-90">
                  {getSelectionText()}
                </p>
                <button
                  disabled={totalSelectedQuestions === 0}
                  onClick={() => {
                    const selectedCatKeys = Object.keys(selectedCategories).filter(k => selectedCategories[k])
                    const adjustedNum = Math.min(numQuestionsPsico, totalSelectedQuestions)

                    const urlParams = new URLSearchParams({
                      categories: selectedCatKeys.join(','),
                      numQuestions: adjustedNum.toString(),
                    })

                    router.push(`/psicotecnicos/test/ejecutar?${urlParams.toString()}`)
                  }}
                  className={`px-6 py-3 rounded-lg font-bold transition-all duration-300 focus:outline-none ${
                    totalSelectedQuestions === 0
                      ? 'bg-white/50 text-white/70 cursor-not-allowed'
                      : 'bg-white text-blue-600 hover:bg-gray-100 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:ring-4 focus:ring-white/50'
                  }`}
                >
                  Empezar Test Psicotécnico
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      </div>
    </div>
  )
}
