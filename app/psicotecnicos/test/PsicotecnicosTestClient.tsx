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

  const [showModal, setShowModal] = useState(false)
  const [modalCategoryKey, setModalCategoryKey] = useState<string | null>(null)
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
          catSelection[cat.key] = true
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

  // Toggle a single section
  const toggleSection = (sectionKey: string) => {
    setSelectedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }

  // Open modal for a category
  const handleBlockClick = (catKey: string) => {
    setModalCategoryKey(catKey)
    setShowModal(true)
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

  // Find modal category object
  const modalCategory = categories.find(c => c.key === modalCategoryKey)

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

        {/* Category list */}
        {dataLoaded && (
          <div className="max-w-2xl mx-auto px-4 mb-8">
            <div className="space-y-3 sm:space-y-4">
              {categories
                .filter(cat => cat.questionCount > 0)
                .map((cat) => (
                <div
                  key={cat.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
                  onClick={() => toggleCategory(cat.key)}
                >
                  <div className="flex items-center mb-2 sm:mb-0">
                    <div className={`w-5 h-5 border-2 rounded mr-3 sm:mr-4 flex-shrink-0 ${
                      selectedCategories[cat.key]
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {selectedCategories[cat.key] && (
                        <svg className="w-3 h-3 text-white m-auto mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-base sm:text-lg font-medium text-gray-900">
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end w-full sm:w-auto gap-2">
                    <span className="text-sm text-gray-600 order-2 sm:order-1">
                      {cat.sections.length > 1
                        ? `${getSelectedSectionsCount(cat)}/${cat.sections.length} subcategorías • ${cat.questionCount} preguntas`
                        : `${cat.questionCount} pregunta${cat.questionCount !== 1 ? 's' : ''}`
                      }
                    </span>
                    {cat.sections.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBlockClick(cat.key)
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors order-1 sm:order-2 self-start sm:self-auto"
                      >
                        Configurar
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
                  onClick={() => {
                    const selectedCatKeys = Object.keys(selectedCategories).filter(k => selectedCategories[k])

                    if (selectedCatKeys.length === 0) {
                      alert('Por favor, selecciona al menos una categoría')
                      return
                    }

                    if (totalSelectedQuestions === 0) {
                      alert('No hay preguntas disponibles para las categorías seleccionadas')
                      return
                    }

                    const adjustedNum = Math.min(numQuestionsPsico, totalSelectedQuestions)

                    const urlParams = new URLSearchParams({
                      categories: selectedCatKeys.join(','),
                      numQuestions: adjustedNum.toString(),
                    })

                    router.push(`/psicotecnicos/test/ejecutar?${urlParams.toString()}`)
                  }}
                  className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 focus:ring-white/50 group"
                >
                  <span className="inline-flex items-center justify-center">
                    Empezar Test Psicotécnico
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      </div>

      {/* Section configuration modal */}
      {showModal && modalCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {modalCategory.name}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {modalCategory.sections.map((section: PsychometricSection) => (
                  <label key={section.key} className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedSections[section.key] || false}
                        onChange={() => toggleSection(section.key)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-900">
                        {section.name}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                      {section.count} preguntas
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
