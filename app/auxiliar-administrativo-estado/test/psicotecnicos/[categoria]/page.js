'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import PsychometricTestLayout from '@/components/PsychometricTestLayout'
import { selectAdaptiveQuestions, analyzeCurrentPerformance } from '@/lib/adaptiveQuestionSelection'

export default function PsychometricTestPage() {
  const { categoria } = useParams()
  const searchParams = useSearchParams()
  const { user, supabase, loading: authLoading } = useAuth()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adaptiveConfig, setAdaptiveConfig] = useState(null)
  const [showStats, setShowStats] = useState(true)
  const [categoryStats, setCategoryStats] = useState(null)

  useEffect(() => {
    async function loadPsychometricQuestions() {
      try {
        const sectionsParam = searchParams.get('sections')
        const selectedSections = sectionsParam ? sectionsParam.split(',') : null
        
        console.log('🔍 Loading psychometric questions for category:', categoria)
        console.log('🎯 Selected sections:', selectedSections)
        
        // Build query with section filtering if specified
        let query = supabase
          .from('psychometric_questions')
          .select(`
            *,
            psychometric_categories!inner(category_key, display_name),
            psychometric_sections!inner(section_key, display_name)
          `)
          .eq('psychometric_categories.category_key', categoria)
          .eq('is_active', true)
        
        // Add section filter if specific sections are selected
        if (selectedSections && selectedSections.length > 0) {
          query = query.in('psychometric_sections.section_key', selectedSections)
        }
        
        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) {
          console.error('❌ Error loading psychometric questions:', error)
          setError('Error al cargar las preguntas psicotécnicas')
          return
        }

        if (!data || data.length === 0) {
          console.log('⚠️ No questions found for category:', categoria)
          setError('No hay preguntas disponibles para esta categoría')
          return
        }

        console.log('✅ Loaded psychometric questions:', data.length)
        
        // Calcular estadísticas de la categoría
        const totalQuestions = data.length
        const officialQuestions = data.filter(q => q.is_official_exam).length
        
        // Obtener estadísticas del usuario si está autenticado
        let userAnsweredCount = 0
        if (user) {
          const { data: userAnswers } = await supabase
            .from('psychometric_test_answers')
            .select('question_id')
            .eq('user_id', user.id)
            .in('question_id', data.map(q => q.id))
          
          userAnsweredCount = new Set(userAnswers?.map(a => a.question_id) || []).size
        }
        
        setCategoryStats({
          total: totalQuestions,
          official: officialQuestions,
          userAnswered: userAnsweredCount,
          sections: data.reduce((acc, q) => {
            const sectionKey = q.psychometric_sections.section_key
            acc[sectionKey] = (acc[sectionKey] || 0) + 1
            return acc
          }, {})
        })
        
        // Aplicar selección adaptativa si el usuario está autenticado
        if (user) {
          console.log('🧠 Applying adaptive question selection...')
          
          // Para prueba inicial, usar rendimiento mock
          // En producción, esto vendría de la sesión actual o análisis previo
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
              'initial-session', // Se actualizará con la sesión real
              data,
              mockPerformance
            )
            
            console.log(`✅ Adaptive selection applied: ${adaptiveQuestions.length} questions ordered`)
            setQuestions(adaptiveQuestions)
            
            setAdaptiveConfig({
              isAdaptive: true,
              filterApplied: 'none', // Se actualizará basado en rendimiento real
              originalCount: data.length,
              selectedCount: adaptiveQuestions.length
            })
            
          } catch (adaptiveError) {
            console.error('❌ Error in adaptive selection, using original order:', adaptiveError)
            setQuestions(data)
            setAdaptiveConfig({
              isAdaptive: false,
              error: adaptiveError.message
            })
          }
        } else {
          console.log('📊 No user authenticated, using original question order')
          setQuestions(data)
          setAdaptiveConfig({
            isAdaptive: false,
            reason: 'no_user'
          })
        }

      } catch (err) {
        console.error('❌ Unexpected error loading questions:', err)
        setError('Error inesperado al cargar las preguntas')
      } finally {
        setLoading(false)
      }
    }

    if (supabase && categoria) {
      loadPsychometricQuestions()
    }
  }, [categoria, supabase, searchParams, user])

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

  // Los usuarios no logueados pueden hacer el test, pero sin selección adaptativa

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando preguntas psicotécnicas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  // Mostrar pantalla de estadísticas antes del test
  if (showStats && categoryStats) {
    const categoryDisplayNames = {
      'capacidad-administrativa': 'Capacidad Administrativa',
      'capacidad-ortografica': 'Capacidad Ortográfica',
      'pruebas-instrucciones': 'Pruebas de Instrucciones',
      'razonamiento-numerico': 'Razonamiento Numérico',
      'razonamiento-verbal': 'Razonamiento Verbal',
      'series-alfanumericas': 'Series Alfanuméricas',
      'series-letras': 'Series de Letras',
      'series-numericas': 'Series Numéricas'
    }

    const sectionDisplayNames = {
      'tablas': 'Tablas',
      'graficos': 'Gráficos', 
      'clasificacion': 'Pruebas de clasificación',
      'atencion-percepcion': 'Pruebas de atención-percepción'
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {categoryDisplayNames[categoria] || categoria}
              </h1>
              <p className="text-gray-600 text-lg">
                Test psicotécnico personalizado
              </p>
            </div>

            {/* Estadísticas principales */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <div className="space-y-4">
                <p className="text-gray-700 text-lg">
                  📊 {categoryStats.total} preguntas disponibles para esta categoría
                </p>
                
                {categoryStats.official > 0 && (
                  <p className="text-purple-600 font-medium text-lg">
                    🏛️ {categoryStats.official} preguntas de exámenes oficiales disponibles
                  </p>
                )}

                {user && categoryStats.userAnswered > 0 && (
                  <p className="text-green-600 font-medium text-lg">
                    ✅ Has respondido {categoryStats.userAnswered} de {categoryStats.total} preguntas
                  </p>
                )}

                {/* Desglose por secciones */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Secciones disponibles:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(categoryStats.sections).map(([sectionKey, count]) => (
                      <div key={sectionKey} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">
                            {sectionDisplayNames[sectionKey] || sectionKey}
                          </span>
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                            {count} preguntas
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowStats(false)}
                className="bg-purple-600 text-white px-8 py-4 rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
              >
                🎯 Empezar Test
              </button>
              
              <Link
                href="/auxiliar-administrativo-estado/test"
                className="bg-gray-600 text-white px-8 py-4 rounded-lg hover:bg-gray-700 transition-colors font-medium text-lg text-center"
              >
                ← Volver al menú
              </Link>
            </div>

            {/* Información adicional */}
            {adaptiveConfig?.isAdaptive && (
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-800 mb-2">🧠 Sistema Adaptativo Activado</h3>
                <p className="text-blue-700">
                  Las preguntas se ordenarán priorizando aquellas que no has visto antes, 
                  seguidas de las que respondiste hace más tiempo.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const config = {
    categoria: categoria,
    tipo: 'psicotecnico',
    adaptive: adaptiveConfig
  }

  return (
    <PsychometricTestLayout
      categoria={categoria}
      config={config}
      questions={questions}
    />
  )
}