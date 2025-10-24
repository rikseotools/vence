'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const PsychometricTestLayout = dynamic(() => import('@/components/PsychometricTestLayout'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando componente de test...</p>
      </div>
    </div>
  )
})
import { selectAdaptiveQuestions, analyzeCurrentPerformance } from '@/lib/adaptiveQuestionSelection'

function MultipleCategoriesPsychometricTestContent() {
  const searchParams = useSearchParams()
  const { user, supabase, loading: authLoading } = useAuth()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adaptiveConfig, setAdaptiveConfig] = useState(null)
  const [selectedCategories, setSelectedCategories] = useState([])

  useEffect(() => {
    async function loadMultipleCategoriesQuestions() {
      try {
        const categoriesParam = searchParams.get('categories')
        const numQuestionsParam = searchParams.get('numQuestions')
        if (!categoriesParam) {
          setError('No se especificaron categorías')
          return
        }

        const categories = categoriesParam.split(',').filter(Boolean)
        const numQuestions = numQuestionsParam ? parseInt(numQuestionsParam, 10) : 25
        setSelectedCategories(categories)
        
        console.log('🔍 Loading psychometric questions for multiple categories:', categories)
        
        if (!supabase) {
          setError('Error de conexión a la base de datos')
          return
        }

        // Mapear categorías del frontend a question_subtypes
        const categoryToSubtypes = {
          'capacidad-administrativa': ['bar_chart', 'pie_chart', 'line_chart', 'mixed_chart', 'data_table'],
          'capacidad-ortografica': ['error_detection', 'text_question', 'word_analysis'],
          'series-numericas': ['sequence_numeric'],
          'series-alfanumericas': ['sequence'],
          'series-letras': ['sequence_letter'],
          'razonamiento-numerico': ['calculation', 'logic'],
          'razonamiento-verbal': ['analogy', 'comprehension'],
          'pruebas-instrucciones': ['pattern', 'attention']
        }

        // Obtener todos los subtypes para las categorías seleccionadas
        const allowedSubtypes = categories.reduce((acc, category) => {
          const subtypes = categoryToSubtypes[category] || []
          return [...acc, ...subtypes]
        }, [])

        console.log('🔍 Filtering by categories:', categories)
        console.log('🔍 Allowed subtypes:', allowedSubtypes)

        if (allowedSubtypes.length === 0) {
          setError('No hay preguntas disponibles para las categorías seleccionadas')
          return
        }

        // Query para obtener preguntas de las categorías seleccionadas solamente
        const { data, error: fetchError } = await supabase
          .from('psychometric_questions')
          .select('*')
          .eq('is_active', true)
          .in('question_subtype', allowedSubtypes)

        if (fetchError) {
          console.error('❌ Error fetching psychometric questions:', fetchError)
          setError('Error al cargar las preguntas')
          return
        }

        if (!data || data.length === 0) {
          setError('No se encontraron preguntas para las categorías seleccionadas')
          return
        }

        console.log(`✅ Found ${data.length} psychometric questions`)

        // Aplicar selección adaptativa si hay suficientes preguntas
        let selectedQuestions = data
        
        if (data.length > numQuestions) {
          try {
            // Usar selección aleatoria simple
            selectedQuestions = data.sort(() => 0.5 - Math.random()).slice(0, numQuestions)
            console.log(`🔀 Using random selection: ${selectedQuestions.length} questions`)
          } catch (selectionError) {
            console.warn('⚠️ Selection failed, using basic slice:', selectionError)
            selectedQuestions = data.slice(0, numQuestions)
          }
        } else {
          selectedQuestions = data.slice(0, numQuestions)
        }

        setQuestions(selectedQuestions)
        console.log(`📊 Final question set: ${selectedQuestions.length} questions`)

      } catch (error) {
        console.error('❌ Error loading psychometric questions:', error)
        setError('Error inesperado al cargar las preguntas')
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading && supabase) {
      loadMultipleCategoriesQuestions()
    }
  }, [searchParams, user, supabase, authLoading])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando test psicotécnico...</p>
        </div>
      </div>
    )
  }


  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link 
            href="/psicotecnicos/test" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
          >
            Volver a configuración
          </Link>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sin preguntas disponibles</h1>
          <p className="text-gray-600 mb-6">No se encontraron preguntas para las categorías seleccionadas</p>
          <Link 
            href="/psicotecnicos/test" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
          >
            Configurar nuevo test
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PsychometricTestLayout 
      questions={questions}
      categoria="múltiples-categorías"
      config={{
        testType: 'psychometric-categories',
        categories: selectedCategories,
        adaptiveConfig,
        backUrl: '/psicotecnicos/test',
        backText: 'Volver a Psicotécnicos'
      }}
    />
  )
}

export default function PsychometricTestExecutor() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparando test...</p>
        </div>
      </div>
    }>
      <MultipleCategoriesPsychometricTestContent />
    </Suspense>
  )
}