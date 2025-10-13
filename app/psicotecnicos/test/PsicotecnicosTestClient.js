'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function PsicotecnicosTestClient() {
  const { user, loading, supabase } = useAuth()
  const router = useRouter()
  const [selectedSections, setSelectedSections] = useState(() => {
    const initialSelection = {}
    
    // Seleccionar todas las subcategorías por defecto
    const allSections = {
      'capacidad-administrativa': ['graficos', 'tablas', 'atencion', 'equivalencias'],
      'capacidad-ortografica': ['ortografia', 'vocabulario'],
      'pruebas-instrucciones': ['instrucciones-simples', 'instrucciones-complejas'],
      'razonamiento-numerico': ['operaciones', 'series', 'problemas', 'fracciones', 'porcentajes', 'ecuaciones', 'geometria', 'estadistica', 'probabilidad', 'logica-matematica', 'calculo-mental', 'magnitudes', 'proporciones'],
      'razonamiento-verbal': ['sinonimos', 'antonimos', 'analogias', 'comprension'],
      'series-alfanumericas': ['series-mixtas', 'patrones-complejos'],
      'series-letras': ['alfabeticas', 'patrones-letras'],
      'series-numericas': ['aritmeticas', 'geometricas']
    }
    
    Object.keys(allSections).forEach(category => {
      allSections[category].forEach(section => {
        initialSelection[section] = true
      })
    })
    
    return initialSelection
  })

  const [selectedCategories, setSelectedCategories] = useState(() => {
    const initialSelection = {}
    const mainCategories = [
      'capacidad-administrativa',
      'capacidad-ortografica', 
      'pruebas-instrucciones',
      'razonamiento-numerico',
      'razonamiento-verbal',
      'series-alfanumericas',
      'series-letras',
      'series-numericas'
    ]
    
    mainCategories.forEach(category => {
      initialSelection[category] = true
    })
    
    return initialSelection
  })

  const [showModal, setShowModal] = useState(false)
  const [modalBlock, setModalBlock] = useState(null)
  const [questionCounts, setQuestionCounts] = useState({})
  const [categoryQuestionCounts, setCategoryQuestionCounts] = useState({})
  const [numQuestionsPsico, setNumQuestionsPsico] = useState(25)

  // Lista de categorías principales
  const mainCategories = [
    'capacidad-administrativa',
    'capacidad-ortografica', 
    'pruebas-instrucciones',
    'razonamiento-numerico',
    'razonamiento-verbal',
    'series-alfanumericas',
    'series-letras',
    'series-numericas'
  ]

  // Subcategorías por bloque
  const blockSections = {
    'capacidad-administrativa': ['graficos', 'tablas', 'atencion', 'equivalencias'],
    'capacidad-ortografica': ['ortografia', 'vocabulario'],
    'pruebas-instrucciones': ['instrucciones-simples', 'instrucciones-complejas'],
    'razonamiento-numerico': ['operaciones', 'series', 'problemas', 'fracciones', 'porcentajes', 'ecuaciones', 'geometria', 'estadistica', 'probabilidad', 'logica-matematica', 'calculo-mental', 'magnitudes', 'proporciones'],
    'razonamiento-verbal': ['sinonimos', 'antonimos', 'analogias', 'comprension'],
    'series-alfanumericas': ['series-mixtas', 'patrones-complejos'],
    'series-letras': ['alfabeticas', 'patrones-letras'],
    'series-numericas': ['aritmeticas', 'geometricas']
  }

  // Función para cargar conteos de todas las categorías principales
  const loadAllCategoryQuestionCounts = async () => {
    if (!supabase) {
      console.log('❌ No hay conexión a Supabase disponible')
      return
    }

    try {
      console.log('📊 Cargando conteos de todas las categorías psicotécnicas')
      
      const { data, error } = await supabase
        .from('psychometric_questions')
        .select('id, category_id, question_subtype')
        .eq('is_active', true)

      if (error) {
        console.error('❌ Error cargando conteos de categorías:', error)
        const emptyCounts = {
          'capacidad-administrativa': 0,
          'capacidad-ortografica': 0,
          'pruebas-instrucciones': 0,
          'razonamiento-numerico': 0,
          'razonamiento-verbal': 0,
          'series-alfanumericas': 0,
          'series-letras': 0,
          'series-numericas': 0
        }
        setCategoryQuestionCounts(emptyCounts)
        return
      }

      if (!data || data.length === 0) {
        const emptyCounts = {
          'capacidad-administrativa': 0,
          'capacidad-ortografica': 0,
          'pruebas-instrucciones': 0,
          'razonamiento-numerico': 0,
          'razonamiento-verbal': 0,
          'series-alfanumericas': 0,
          'series-letras': 0,
          'series-numericas': 0
        }
        setCategoryQuestionCounts(emptyCounts)
        return
      }

      // Contar por categorías reales basadas en category_id y question_subtype
      const counts = {
        'capacidad-administrativa': data.filter(q => 
          q.question_subtype === 'bar_chart' || 
          q.question_subtype === 'pie_chart' || 
          q.question_subtype === 'line_chart' ||
          q.question_subtype === 'mixed_chart'
        ).length,
        'capacidad-ortografica': 0,
        'pruebas-instrucciones': 0,
        'razonamiento-numerico': 0,
        'razonamiento-verbal': 0,
        'series-alfanumericas': 0,
        'series-letras': 0,
        'series-numericas': 0
      }

      setCategoryQuestionCounts(counts)

    } catch (error) {
      console.error('❌ Error inesperado cargando categorías:', error)
    }
  }

  // Función para cargar conteo de preguntas psicotécnicas por subcategorías
  const loadPsychometricQuestionCounts = async (categoryKey) => {
    if (!supabase) return
    try {
      console.log('📊 Cargando conteo de preguntas para:', categoryKey)
      
      const { data, error } = await supabase
        .from('psychometric_questions')
        .select('id, category_id, question_subtype')
        .eq('is_active', true)

      if (error) {
        console.error('❌ Error cargando conteos:', error)
        return
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No se encontraron preguntas para:', categoryKey)
        setQuestionCounts({})
        return
      }

      // Contar preguntas por subtipo según la categoría
      const counts = {}
      
      // Inicializar contadores para todas las subcategorías de esta categoría
      if (blockSections[categoryKey]) {
        blockSections[categoryKey].forEach(section => {
          counts[section] = 0
        })
      }

      // Contar preguntas según la categoría y question_subtype
      data.forEach(question => {
        // SOLO asignar a capacidad-administrativa si realmente es una pregunta de gráficos
        if (categoryKey === 'capacidad-administrativa') {
          if (question.question_subtype === 'bar_chart' || 
              question.question_subtype === 'pie_chart' || 
              question.question_subtype === 'line_chart' ||
              question.question_subtype === 'mixed_chart') {
            // Todas las preguntas de gráficos van a la subcategoría 'graficos'
            counts['graficos'] = (counts['graficos'] || 0) + 1
          }
        }
        // Para otras categorías, NO asignar preguntas aleatorias - solo si realmente corresponden
        // Por ahora no tenemos preguntas específicas para estas categorías
      })

      console.log('📊 Conteos calculados para', categoryKey, ':', counts)
      
      setQuestionCounts(prevCounts => ({
        ...prevCounts,
        ...counts
      }))

    } catch (error) {
      console.error('❌ Error inesperado:', error)
    }
  }

  // Cargar conteos al montar el componente
  useEffect(() => {
    loadAllCategoryQuestionCounts()
    
    // Cargar conteos específicos por subcategoría para todas las categorías
    Object.keys(blockSections).forEach(categoryKey => {
      loadPsychometricQuestionCounts(categoryKey)
    })
  }, [supabase])

  // Función para obtener el número total de preguntas seleccionadas
  const getTotalSelectedQuestions = () => {
    return Object.values(categoryQuestionCounts).reduce((total, count) => {
      return total + count
    }, 0)
  }

  // Función para contar subcategorías seleccionadas por categoría
  const getSelectedSectionsCount = (categoryKey) => {
    const sections = blockSections[categoryKey] || []
    return sections.filter(section => selectedSections[section]).length
  }

  // Función para obtener el conteo de preguntas para categorías seleccionadas
  const getSelectedCategoriesQuestionCount = () => {
    return Object.entries(selectedCategories).reduce((total, [categoryKey, isSelected]) => {
      if (isSelected) {
        // Sumar solo las preguntas de las subcategorías seleccionadas
        const subcategories = blockSections[categoryKey] || []
        const selectedSubcategoriesCount = subcategories.reduce((subTotal, subcategory) => {
          if (selectedSections[subcategory]) {
            return subTotal + (questionCounts[subcategory] || 0)
          }
          return subTotal
        }, 0)
        
        return total + selectedSubcategoriesCount
      }
      return total
    }, 0)
  }

  // Función para manejar el clic en una categoría
  const handleBlockClick = (categoryKey) => {
    setModalBlock(categoryKey)
    setShowModal(true)
    // Cargar conteos de preguntas al abrir el modal
    loadPsychometricQuestionCounts(categoryKey)
  }

  // Función para alternar una subcategoría específica
  const toggleSection = (sectionKey) => {
    setSelectedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }))
  }

  // Función para alternar toda una categoría
  const toggleCategory = (categoryKey) => {
    const sections = blockSections[categoryKey] || []
    const allSelected = sections.every(section => selectedSections[section])
    
    const newSelections = { ...selectedSections }
    sections.forEach(section => {
      newSelections[section] = !allSelected
    })
    
    setSelectedSections(newSelections)
    
    // También actualizar el estado de la categoría principal
    setSelectedCategories(prev => ({
      ...prev,
      [categoryKey]: !allSelected
    }))
  }

  // Generar URL del test
  const generateTestUrl = () => {
    const selectedCategoriesList = Object.entries(selectedCategories)
      .filter(([_, isSelected]) => isSelected)
      .map(([categoryKey, _]) => categoryKey)
    
    if (selectedCategoriesList.length === 0) return null
    
    const params = new URLSearchParams({
      categorias: selectedCategoriesList.join(','),
      preguntas: numQuestionsPsico.toString()
    })
    
    return `/auxiliar-administrativo-estado/test/psicotecnico?${params.toString()}`
  }

  // Función para obtener texto de selección
  const getSelectionText = () => {
    const selectedSectionIds = Object.keys(selectedSections).filter(sectionId => selectedSections[sectionId])
    const totalQuestions = getSelectedCategoriesQuestionCount()
    
    if (selectedSectionIds.length === 0) {
      return "Selecciona al menos una categoría para empezar"
    }
    
    const selectedCategoriesCount = Object.values(selectedCategories).filter(Boolean).length
    
    return `${selectedCategoriesCount} categoría${selectedCategoriesCount !== 1 ? 's' : ''} seleccionada${selectedCategoriesCount !== 1 ? 's' : ''} • ${totalQuestions} preguntas disponibles`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }


  const testUrl = generateTestUrl()
  const totalSelectedQuestions = getSelectedCategoriesQuestionCount()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Tests Psicotécnicos
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto mb-4">
            Selecciona las categorías que quieres practicar y configura tu test personalizado
          </p>
          {/* Mensaje de desarrollo */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-2 text-blue-700">
              <span className="text-lg">🚀</span>
              <p className="text-sm font-medium">
                <strong>¡Estamos en desarrollo!</strong> Durante octubre añadiremos preguntas psicotécnicas diariamente.
                <br />
                <span className="text-blue-600">Si haces las preguntas disponibles hoy y vuelves mañana, ¡verás que hay nuevas!</span>
              </p>
            </div>
          </div>
        </div>

        {/* Lista estilo checklist simple */}
        <div className="max-w-2xl mx-auto px-4 mb-8">
          <div className="space-y-3 sm:space-y-4">
            {mainCategories.map((categoryKey) => (
              <div 
                key={categoryKey}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer" 
                onClick={() => toggleCategory(categoryKey)}
              >
                <div className="flex items-center mb-2 sm:mb-0">
                  <div className={`w-5 h-5 border-2 rounded mr-3 sm:mr-4 flex-shrink-0 ${
                    selectedCategories[categoryKey] 
                      ? 'bg-blue-600 border-blue-600' 
                      : 'border-gray-300'
                  }`}>
                    {selectedCategories[categoryKey] && (
                      <svg className="w-3 h-3 text-white m-auto mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-base sm:text-lg font-medium text-gray-900">
                      {categoryKey === 'capacidad-administrativa' ? 'Capacidad administrativa' :
                       categoryKey === 'capacidad-ortografica' ? 'Capacidad ortográfica' :
                       categoryKey === 'pruebas-instrucciones' ? 'Pruebas de instrucciones' :
                       categoryKey === 'razonamiento-numerico' ? 'Razonamiento numérico' :
                       categoryKey === 'razonamiento-verbal' ? 'Razonamiento verbal' :
                       categoryKey === 'series-alfanumericas' ? 'Series alfanuméricas' :
                       categoryKey === 'series-letras' ? 'Series de letras' :
                       categoryKey === 'series-numericas' ? 'Series numéricas' : categoryKey}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end w-full sm:w-auto gap-2">
                  <span className="text-sm text-gray-600 order-2 sm:order-1">
                    {getSelectedSectionsCount(categoryKey)}/{(blockSections[categoryKey] || []).length} subcategorías • {categoryQuestionCounts[categoryKey] || 0} preguntas
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBlockClick(categoryKey)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors order-1 sm:order-2 self-start sm:self-auto"
                  >
                    Configurar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configuración del test */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Configuración del test
          </h3>
          
          <div className="space-y-6">
            {/* Selección de número de preguntas */}
            <div className="text-center">
              <div className="text-lg font-medium text-gray-900 mb-4">📝 Número de preguntas</div>
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
            
            {/* Información de preguntas disponibles */}
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900 mb-1">
                Preguntas disponibles
              </div>
              <div className="text-3xl font-bold text-green-600">
                {totalSelectedQuestions}
              </div>
            </div>
            
            {/* Botón Empezar Test para Psicotécnicos */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white text-center">
              <p className="mb-4 text-sm opacity-90">
                {getSelectionText()}
              </p>
              <button
                onClick={() => {
                  const selectedSectionIds = Object.keys(selectedSections).filter(sectionId => selectedSections[sectionId])
                  const totalQuestions = getSelectedCategoriesQuestionCount()
                  
                  if (selectedSectionIds.length === 0) {
                    alert('Por favor, selecciona al menos una subcategoría')
                    return
                  }
                  
                  if (totalQuestions === 0) {
                    alert('No hay preguntas disponibles para las subcategorías seleccionadas')
                    return
                  }
                  
                  if (numQuestionsPsico > totalQuestions) {
                    alert(`Solo hay ${totalQuestions} preguntas disponibles. Reduce el número de preguntas o selecciona más subcategorías.`)
                    return
                  }
                  
                  // Construir URL con parámetros de categorías seleccionadas
                  const selectedCategoryKeys = Object.keys(selectedCategories).filter(catKey => selectedCategories[catKey])
                  const urlParams = new URLSearchParams()
                  if (selectedCategoryKeys.length > 0) {
                    urlParams.set('categories', selectedCategoryKeys.join(','))
                  }
                  // Añadir parámetro de número de preguntas
                  urlParams.set('numQuestions', numQuestionsPsico.toString())
                  
                  // Redirigir al test psicotécnico con parámetros
                  router.push(`/psicotecnicos/test/ejecutar?${urlParams.toString()}`)
                }}
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 focus:ring-white/50 group"
              >
                <span className="inline-flex items-center justify-center">
                  <span className="mr-2 group-hover:animate-bounce">🧩</span>
                  Empezar Test Psicotécnico
                </span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Modal de configuración de subcategorías */}
      {showModal && modalBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {modalBlock === 'capacidad-administrativa' ? 'Capacidad Administrativa' :
                   modalBlock === 'capacidad-ortografica' ? 'Capacidad Ortográfica' :
                   modalBlock === 'pruebas-instrucciones' ? 'Pruebas de Instrucciones' :
                   modalBlock === 'razonamiento-numerico' ? 'Razonamiento Numérico' :
                   modalBlock === 'razonamiento-verbal' ? 'Razonamiento Verbal' :
                   modalBlock === 'series-alfanumericas' ? 'Series Alfanuméricas' :
                   modalBlock === 'series-letras' ? 'Series de Letras' :
                   modalBlock === 'series-numericas' ? 'Series Numéricas' : modalBlock}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-3">
                {(blockSections[modalBlock] || []).map((section) => (
                  <label key={section} className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedSections[section] || false}
                        onChange={() => toggleSection(section)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-900 capitalize">
                        {section.replace('-', ' ')}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                      {questionCounts[section] || 0} preguntas
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