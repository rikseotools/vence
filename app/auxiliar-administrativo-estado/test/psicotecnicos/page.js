'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import PsychometricTestLayout from '@/components/PsychometricTestLayout'
import { selectAdaptiveQuestions, analyzeCurrentPerformance } from '@/lib/adaptiveQuestionSelection'

export default function MultipleCategoriesPsychometricTestPage() {
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
        if (!categoriesParam) {
          setError('No se especificaron categorías')
          return
        }

        const categories = categoriesParam.split(',').filter(Boolean)
        setSelectedCategories(categories)
        
        console.log('🔍 Loading psychometric questions for multiple categories:', categories)
        
        if (!supabase) {
          setError('Error de conexión a la base de datos')
          return
        }

        // Build query for multiple categories
        const { data, error } = await supabase
          .from('psychometric_questions')
          .select(`
            *,
            psychometric_categories!inner(category_key, display_name),
            psychometric_sections!inner(section_key, display_name)
          `)
          .in('psychometric_categories.category_key', categories)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('❌ Error loading psychometric questions:', error)
          setError('Error al cargar las preguntas psicotécnicas')
          return
        }

        if (!data || data.length === 0) {
          console.log('⚠️ No questions found for categories:', categories)
          setError('No hay preguntas disponibles para las categorías seleccionadas')
          return
        }

        console.log('✅ Loaded psychometric questions:', data.length)
        
        // Aplicar selección adaptativa si el usuario está autenticado
        if (user) {
          console.log('🧠 Applying adaptive question selection for multiple categories...')
          
          // Para prueba inicial, usar rendimiento mock
          const mockPerformance = {
            questionsAnswered: 0,
            correctAnswers: 0,
            accuracy: 0,
            incorrectStreak: 0,
            recentAccuracy: 0,
            needsIntervention: false
          }
          
          try {
            const adaptiveQuestions = await selectAdaptiveQuestions(
              supabase,
              user.id,
              'initial-session-multiple', // Se actualizará con la sesión real
              data,
              mockPerformance
            )
            
            console.log(`✅ Adaptive selection applied: ${adaptiveQuestions.length} questions ordered from ${categories.length} categories`)
            
            // Mezclar preguntas de diferentes categorías de forma aleatoria
            const shuffledQuestions = [...adaptiveQuestions].sort(() => Math.random() - 0.5)
            setQuestions(shuffledQuestions)
            
            setAdaptiveConfig({
              isAdaptive: true,
              filterApplied: 'none',
              originalCount: data.length,
              selectedCount: shuffledQuestions.length,
              categoriesCount: categories.length,
              categories: categories
            })
            
          } catch (adaptiveError) {
            console.error('❌ Error in adaptive selection, using original order:', adaptiveError)
            // Mezclar preguntas de forma aleatoria como fallback
            const shuffledQuestions = [...data].sort(() => Math.random() - 0.5)
            setQuestions(shuffledQuestions)
            setAdaptiveConfig({
              isAdaptive: false,
              error: adaptiveError.message,
              categoriesCount: categories.length,
              categories: categories
            })
          }
        } else {
          console.log('📊 No user authenticated, using shuffled question order')
          // Mezclar preguntas de forma aleatoria para usuarios no autenticados
          const shuffledQuestions = [...data].sort(() => Math.random() - 0.5)
          setQuestions(shuffledQuestions)
          setAdaptiveConfig({
            isAdaptive: false,
            reason: 'no_user',
            categoriesCount: categories.length,
            categories: categories
          })
        }

      } catch (err) {
        console.error('❌ Unexpected error loading questions:', err)
        setError('Error inesperado al cargar las preguntas')
      } finally {
        setLoading(false)
      }
    }

    if (supabase) {
      loadMultipleCategoriesQuestions()
    }
  }, [supabase, searchParams, user])

  // Loading del auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando preguntas psicotécnicas...</p>
          {selectedCategories.length > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              {selectedCategories.length} categorías seleccionadas
            </p>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <p className="text-gray-600 mb-4">
            {selectedCategories.length > 0 && (
              <>Categorías solicitadas: {selectedCategories.join(', ')}</>
            )}
          </p>
          <Link
            href="/auxiliar-administrativo-estado/test"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Volver a Tests
          </Link>
        </div>
      </div>
    )
  }

  const config = {
    categoria: 'multiple-categories',
    tipo: 'psicotecnico-multiple',
    adaptive: adaptiveConfig,
    categories: selectedCategories
  }

  return (
    <PsychometricTestLayout
      categoria={`${selectedCategories.length} categorías`}
      config={config}
      questions={questions}
    />
  )
}