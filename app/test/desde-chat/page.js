// app/test/desde-chat/page.js
// Test iniciado desde el chat de IA - soporta tests de leyes y tests de preguntas falladas
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '@/components/TestPageWrapper'
import TestLayout from '@/components/TestLayout'
import { getSupabaseClient } from '@/lib/supabase'

function TestDesdeChatContent() {
  const searchParams = useSearchParams()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [testMode, setTestMode] = useState(null) // 'laws' | 'failed_questions'
  const [questions, setQuestions] = useState([])

  useEffect(() => {
    async function loadConfig() {
      try {
        // Verificar si es un test de preguntas falladas
        const failedQuestionIdsParam = searchParams.get('failed_question_ids')
        const onlyFailed = searchParams.get('only_failed') === 'true'

        if (failedQuestionIdsParam && onlyFailed) {
          // Modo: Test de preguntas falladas
          console.log('🎯 [desde-chat] Modo failed_questions detectado')
          const questionIds = JSON.parse(failedQuestionIdsParam)
          console.log('🎯 [desde-chat] Question IDs:', questionIds.length)

          if (!questionIds || questionIds.length === 0) {
            setError('No hay preguntas para el test')
            setLoading(false)
            return
          }

          // Cargar las preguntas directamente por IDs
          const supabase = getSupabaseClient()
          console.log('🎯 [desde-chat] Fetching questions from Supabase...')
          const { data: questionsData, error: fetchError } = await supabase
            .from('questions')
            .select(`
              id,
              question_text,
              options,
              explanation,
              difficulty,
              law_id,
              article_id,
              laws(name, slug),
              law_articles(article_number, title_text)
            `)
            .in('id', questionIds)
            .eq('is_active', true)

          console.log('🎯 [desde-chat] Supabase response:', {
            hasData: !!questionsData,
            count: questionsData?.length,
            error: fetchError?.message
          })

          if (fetchError) {
            console.error('🎯 [desde-chat] Error fetching questions:', fetchError)
            setError('Error al cargar las preguntas')
            setLoading(false)
            return
          }

          if (!questionsData || questionsData.length === 0) {
            console.error('🎯 [desde-chat] No questions found')
            setError('No se encontraron las preguntas')
            setLoading(false)
            return
          }

          console.log('🎯 [desde-chat] Questions loaded:', questionsData.length)

          // Transformar preguntas al formato esperado por TestLayout
          const transformedQuestions = questionsData.map(q => ({
            id: q.id,
            question_text: q.question_text,
            options: q.options,
            explanation: q.explanation,
            difficulty: q.difficulty,
            law_name: q.laws?.name || 'Desconocida',
            law_slug: q.laws?.slug,
            article_number: q.law_articles?.article_number,
            article_title: q.law_articles?.title_text
          }))

          setQuestions(transformedQuestions)
          setTestMode('failed_questions')
          setConfig({
            count: transformedQuestions.length,
            orderBy: searchParams.get('failed_questions_order') || 'recent'
          })
          setLoading(false)
          return
        }

        // Modo: Test de leyes (comportamiento original)
        const selectedLawsParam = searchParams.get('selected_laws')
        const numQuestions = parseInt(searchParams.get('n') || '10')

        if (!selectedLawsParam) {
          setError('No se especificaron leyes para el test')
          setLoading(false)
          return
        }

        const selectedLaws = JSON.parse(selectedLawsParam)

        if (!selectedLaws || selectedLaws.length === 0) {
          setError('No hay leyes seleccionadas')
          setLoading(false)
          return
        }

        setTestMode('laws')
        setConfig({
          selectedLaws,
          count: numQuestions,
          excludeRecent: false,
          difficultyMode: 'random',
          adaptiveMode: true
        })

        setLoading(false)
      } catch (e) {
        console.error('Error parsing test config:', e)
        setError('Error al cargar la configuración del test')
        setLoading(false)
      }
    }

    loadConfig()
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Preparando tu test...
          </h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            {error}
          </h2>
          <p className="text-gray-600 mb-6">
            Para crear un test desde el chat, primero pregunta sobre algún tema
            y usa la opción del test correspondiente.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    )
  }

  // Modo: Test de preguntas falladas - usa TestLayout directamente
  if (testMode === 'failed_questions' && questions.length > 0) {
    return (
      <TestLayout
        tema={0}
        testNumber="repaso_fallos"
        config={{
          name: "Test de Repaso de Fallos",
          description: `Practicando ${questions.length} preguntas que necesitas reforzar`,
          subtitle: "Repasa tus puntos débiles",
          icon: "🎯",
          color: "from-red-500 to-orange-600"
        }}
        questions={questions}
      />
    )
  }

  // Modo: Test de leyes - usa TestPageWrapper
  if (testMode === 'laws' && config) {
    const lawsTitle = config.selectedLaws.length === 1
      ? config.selectedLaws[0]
      : `${config.selectedLaws.length} leyes`

    return (
      <TestPageWrapper
        tema={null}
        testType="personalizado"
        customTitle={`Test de ${lawsTitle}`}
        customDescription="Test generado desde el asistente de IA"
        customIcon="🤖"
        customColor="from-purple-500 to-indigo-600"
        customSubtitle={config.selectedLaws.join(' • ')}
        loadingMessage="🤖 Cargando preguntas..."
        defaultConfig={{
          selectedLaws: config.selectedLaws,
          count: config.count,
          numQuestions: config.count,
          excludeRecent: config.excludeRecent,
          difficultyMode: config.difficultyMode,
          adaptiveMode: config.adaptiveMode
        }}
      />
    )
  }

  // Fallback loading
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Preparando tu test...
        </h2>
      </div>
    </div>
  )
}

export default function TestDesdeChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            🤖 Preparando test desde el chat...
          </h2>
        </div>
      </div>
    }>
      <TestDesdeChatContent />
    </Suspense>
  )
}
