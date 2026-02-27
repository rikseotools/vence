// app/auxiliar-administrativo-cyl/test/tema/[numero]/test-examen/page.js
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
  const [resumeTestId, setResumeTestId] = useState(null)
  const [savedAnswers, setSavedAnswers] = useState(null)

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)
      const resume = searchParams.get('resume')

      setResolvedParams(resolved)
      setTemaNumber(tema)
      setResumeTestId(resume)

      if (process.env.NODE_ENV === 'development') {
        console.log('📝 Test examen Aux. Admin. CyL tema:', tema)
        console.log('📋 Parámetros URL:', Object.fromEntries(searchParams.entries()))
        if (resume) console.log('🔄 Reanudando examen:', resume)
      }
    }

    resolveParams()
  }, [params, searchParams])

  useEffect(() => {
    if (!temaNumber) return

    if (resumeTestId) {
      loadResumedExam()
    } else {
      loadExamQuestions()
    }
  }, [temaNumber, resumeTestId])

  async function loadResumedExam() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/exam/resume?testId=${resumeTestId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error obteniendo datos del examen')
      }

      setQuestions(data.questions)
      setSavedAnswers(data.savedAnswers)
      setLoading(false)

    } catch (error) {
      console.error('❌ Error reanudando examen:', error)
      setError(error.message)
      setLoading(false)
    }
  }

  async function loadExamQuestions() {
    try {
      setLoading(true)
      setError(null)

      const numQuestions = parseInt(searchParams.get('n')) || 25
      const onlyOfficialQuestions = searchParams.get('only_official') === 'true'
      const difficultyMode = searchParams.get('difficulty_mode') || 'random'
      const selectedLawsParam = searchParams.get('selected_laws')
      const selectedArticlesByLawParam = searchParams.get('selected_articles_by_law')
      const selectedSectionFiltersParam = searchParams.get('selected_section_filters')

      let selectedLaws = []
      let selectedArticlesByLaw = {}
      let selectedSectionFilters = []

      try {
        selectedLaws = selectedLawsParam ? JSON.parse(selectedLawsParam) : []
        selectedArticlesByLaw = selectedArticlesByLawParam ? JSON.parse(selectedArticlesByLawParam) : {}
        selectedSectionFilters = selectedSectionFiltersParam ? JSON.parse(selectedSectionFiltersParam) : []
      } catch (parseError) {
        console.error('❌ Error parsing URL params:', parseError)
      }

      const response = await fetch('/api/questions/filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicNumber: temaNumber,
          positionType: 'auxiliar_administrativo_cyl',
          numQuestions,
          selectedLaws,
          selectedArticlesByLaw,
          selectedSectionFilters,
          onlyOfficialQuestions,
          difficultyMode
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error obteniendo preguntas')
      }

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

  if (!temaNumber || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando examen...</p>
        </div>
      </div>
    )
  }

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
            href={`/auxiliar-administrativo-cyl/test/tema/${temaNumber}`}
            className="inline-flex items-center px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            ← Volver al tema
          </a>
        </div>
      </div>
    )
  }

  // CyL: 28 temas (1-28)
  if (isNaN(temaNumber) || temaNumber < 1 || temaNumber > 28) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Válido
          </h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber} no es válido para Auxiliar Administrativo Castilla y León.
          </p>
          <a
            href="/auxiliar-administrativo-cyl/test"
            className="inline-flex items-center px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            ← Volver a todos los temas
          </a>
        </div>
      </div>
    )
  }

  const testConfig = {
    numQuestions: parseInt(searchParams.get('n')) || 25,
    onlyOfficialQuestions: searchParams.get('only_official') === 'true',
    difficultyMode: searchParams.get('difficulty_mode') || 'random',
    timeLimit: searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')) : null
  }

  return (
    <ExamLayout
      tema={temaNumber}
      testNumber={null}
      config={testConfig}
      questions={questions}
      resumeTestId={resumeTestId}
      initialAnswers={savedAnswers}
    />
  )
}

export default function TestExamenPage({ params }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando examen...</p>
        </div>
      </div>
    }>
      <TestExamenContent params={params} />
    </Suspense>
  )
}
