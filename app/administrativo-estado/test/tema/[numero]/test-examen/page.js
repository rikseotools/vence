// app/administrativo-estado/test/tema/[numero]/test-examen/page.js
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ExamLayout from '../../../../../../components/ExamLayout'

function TestExamenContent({ params }) {
  const searchParams = useSearchParams()
  const [resolvedParams, setResolvedParams] = useState(null)
  const [temaNumber, setTemaNumber] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Resolver params async
  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)

      setResolvedParams(resolved)
      setTemaNumber(tema)

      if (process.env.NODE_ENV === 'development') {
        console.log('📝 Test examen tema administrativo:', tema)
        console.log('📋 Parámetros URL:', Object.fromEntries(searchParams.entries()))
      }
    }

    resolveParams()
  }, [params, searchParams])

  // Cargar preguntas
  useEffect(() => {
    if (!temaNumber) return

    loadExamQuestions()
  }, [temaNumber])

  // 🚀 USAR NUEVA API (Drizzle + Zod) - Elimina lógica duplicada
  async function loadExamQuestions() {
    try {
      setLoading(true)
      setError(null)

      // Obtener configuración desde URL
      const numQuestions = parseInt(searchParams.get('n')) || 25
      const onlyOfficialQuestions = searchParams.get('only_official') === 'true'
      const difficultyMode = searchParams.get('difficulty_mode') || 'random'
      const selectedLawsParam = searchParams.get('selected_laws')
      const selectedArticlesByLawParam = searchParams.get('selected_articles_by_law')
      const selectedSectionFiltersParam = searchParams.get('selected_section_filters')
      const onlyFailedQuestions = searchParams.get('only_failed') === 'true'
      const failedQuestionIdsParam = typeof window !== 'undefined' ? sessionStorage.getItem('pendingFailedQuestionIds') : null

      let selectedLaws = []
      let selectedArticlesByLaw = {}
      let selectedSectionFilters = []
      let failedQuestionIds = []

      try {
        selectedLaws = selectedLawsParam ? JSON.parse(selectedLawsParam) : []
        selectedArticlesByLaw = selectedArticlesByLawParam ? JSON.parse(selectedArticlesByLawParam) : {}
        selectedSectionFilters = selectedSectionFiltersParam ? JSON.parse(selectedSectionFiltersParam) : []
        failedQuestionIds = failedQuestionIdsParam ? JSON.parse(failedQuestionIdsParam) : []
        if (failedQuestionIdsParam) sessionStorage.removeItem('pendingFailedQuestionIds')
      } catch (parseError) {
        console.error('❌ Error parsing URL params:', parseError)
      }

      console.log('🚀 Cargando preguntas via API (administrativo):', {
        tema: temaNumber,
        numQuestions,
        onlyOfficialQuestions,
        selectedLaws: selectedLaws.length,
        selectedSectionFilters: selectedSectionFilters.length
      })

      // 🚀 LLAMAR A LA NUEVA API
      const response = await fetch('/api/questions/filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicNumber: temaNumber,
          positionType: 'administrativo',
          numQuestions,
          selectedLaws,
          selectedArticlesByLaw,
          selectedSectionFilters,
          onlyOfficialQuestions,
          difficultyMode,
          onlyFailedQuestions,
          failedQuestionIds
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error obteniendo preguntas')
      }

      console.log(`✅ API devolvió ${data.questions?.length || 0} preguntas (${data.totalAvailable} disponibles)`)

      // Transformar al formato que ExamLayout espera (Supabase format)
      const transformedQuestions = (data.questions || []).map(q => ({
        id: q.id,
        question_text: q.question,
        option_a: q.options[0],
        option_b: q.options[1],
        option_c: q.options[2],
        option_d: q.options[3],
        explanation: q.explanation,
        difficulty: q.metadata?.difficulty,
        is_official_exam: q.metadata?.is_official_exam,
        primary_article_id: q.primary_article_id,
        exam_source: q.metadata?.exam_source,
        exam_date: q.metadata?.exam_date,
        exam_entity: q.metadata?.exam_entity,
        articles: {
          id: q.article?.id,
          article_number: q.article?.number,
          title: q.article?.title,
          content: q.article?.full_text,
          laws: {
            short_name: q.article?.law_short_name,
            name: q.article?.law_name
          }
        }
      }))

      setQuestions(transformedQuestions)
      setLoading(false)

    } catch (error) {
      console.error('❌ Error cargando preguntas para examen:', error)
      setError(error.message)
      setLoading(false)
    }
  }

  // Loading state
  if (!temaNumber || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando examen...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Error al cargar examen
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href={`/administrativo-estado/test/tema/${temaNumber}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver al tema
          </a>
        </div>
      </div>
    )
  }

  // Validar tema - Administrativo C1:
  // Bloque I (1-11), II (201-204), III (301-307), IV (401-409), V (501-506), VI (601-608)
  const validRanges = [
    [1, 11],     // Bloque I
    [201, 204],  // Bloque II
    [301, 307],  // Bloque III
    [401, 409],  // Bloque IV
    [501, 506],  // Bloque V
    [601, 608]   // Bloque VI
  ]
  const isValidTema = validRanges.some(([min, max]) => temaNumber >= min && temaNumber <= max)

  // Obtener número de display (número dentro del bloque)
  const getDisplayNumber = (num) => {
    if (num >= 1 && num <= 11) return num  // Bloque I: 1-11
    return num % 100  // Bloques II-VI: 201→1, 302→2, etc.
  }

  if (isNaN(temaNumber) || !isValidTema) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Válido
          </h1>
          <p className="text-gray-600 mb-6">
            El Tema {getDisplayNumber(temaNumber)} no es válido para Administrativo del Estado (C1).
          </p>
          <a
            href="/administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a todos los temas
          </a>
        </div>
      </div>
    )
  }

  // Extraer configuración
  const testConfig = {
    numQuestions: parseInt(searchParams.get('n')) || 25,
    onlyOfficialQuestions: searchParams.get('only_official') === 'true',
    difficultyMode: searchParams.get('difficulty_mode') || 'random',
    timeLimit: searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')) : null
  }

  // Renderizar examen
  return (
    <ExamLayout
      tema={temaNumber}
      testNumber={null}
      config={testConfig}
      questions={questions}
      positionType="administrativo"
    />
  )
}

export default function TestExamenPage({ params }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando examen...</p>
        </div>
      </div>
    }>
      <TestExamenContent params={params} />
    </Suspense>
  )
}
