// app/auxiliar-administrativo-estado/test/tema/[numero]/test-examen/page.js
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '../../../../../../lib/supabase'
import ExamLayout from '../../../../../../components/ExamLayout'

const supabase = getSupabaseClient()

function TestExamenContent({ params }) {
  const searchParams = useSearchParams()
  const [resolvedParams, setResolvedParams] = useState(null)
  const [temaNumber, setTemaNumber] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // 🆕 Estado para reanudar examen
  const [resumeTestId, setResumeTestId] = useState(null)
  const [savedAnswers, setSavedAnswers] = useState(null)

  // ✅ RESOLVER PARAMS ASYNC
  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)
      const resume = searchParams.get('resume')

      setResolvedParams(resolved)
      setTemaNumber(tema)
      setResumeTestId(resume)

      if (process.env.NODE_ENV === 'development') {
        console.log('📝 Test examen tema dinámico:', tema)
        console.log('📋 Parámetros URL:', Object.fromEntries(searchParams.entries()))
        if (resume) console.log('🔄 Reanudando examen:', resume)
      }
    }

    resolveParams()
  }, [params, searchParams])

  // ✅ CARGAR PREGUNTAS (nuevo o reanudando)
  useEffect(() => {
    if (!temaNumber) return

    if (resumeTestId) {
      loadResumedExam()
    } else {
      loadExamQuestions()
    }
  }, [temaNumber, resumeTestId])

  // 🆕 CARGAR EXAMEN REANUDADO (via API layer)
  async function loadResumedExam() {
    try {
      setLoading(true)
      setError(null)

      console.log('🔄 Cargando examen reanudado via API:', resumeTestId)

      // Usar el endpoint /api/exam/resume que usa Drizzle + Zod
      const response = await fetch(`/api/exam/resume?testId=${resumeTestId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error obteniendo datos del examen')
      }

      console.log('✅ Examen reanudado:', data.totalQuestions, 'preguntas,', data.answeredCount, 'respondidas')

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

      // Obtener configuración desde URL
      const numQuestions = parseInt(searchParams.get('n')) || 25
      const onlyOfficialQuestions = searchParams.get('only_official') === 'true'
      const difficultyMode = searchParams.get('difficulty_mode') || 'random'
      const selectedLawsParam = searchParams.get('selected_laws')
      const selectedArticlesByLawParam = searchParams.get('selected_articles_by_law')
      const selectedSectionFiltersParam = searchParams.get('selected_section_filters') // 📚 FILTRO DE TÍTULOS

      let selectedLaws = []
      let selectedArticlesByLaw = {}
      let selectedSectionFilters = []

      try {
        selectedLaws = selectedLawsParam ? JSON.parse(selectedLawsParam) : []
        selectedArticlesByLaw = selectedArticlesByLawParam ? JSON.parse(selectedArticlesByLawParam) : {}
        selectedSectionFilters = selectedSectionFiltersParam ? JSON.parse(selectedSectionFiltersParam) : []
      } catch (error) {
        console.error('❌ Error parsing URL params:', error)
      }

      console.log('🎯 Cargando preguntas para examen:', {
        tema: temaNumber,
        numQuestions,
        onlyOfficialQuestions,
        difficultyMode,
        selectedLaws: selectedLaws.length,
        selectedArticles: Object.keys(selectedArticlesByLaw).length
      })

      // 1️⃣ Obtener mapeo del tema desde topic_scope
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id, name),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', temaNumber)
        .eq('topics.position_type', 'auxiliar_administrativo')

      if (mappingError || !mappings?.length) {
        throw new Error(`No se encontró mapeo para tema ${temaNumber}`)
      }

      console.log('📊 Mapeo obtenido:', mappings.length, 'leyes')

      // 2️⃣ Filtrar por leyes seleccionadas si hay filtros
      let filteredMappings = mappings
      if (selectedLaws.length > 0) {
        filteredMappings = mappings.filter(m => selectedLaws.includes(m.laws.short_name))
      }

      // 3️⃣ Aplicar filtro de artículos por ley si hay
      if (Object.keys(selectedArticlesByLaw).length > 0) {
        filteredMappings = filteredMappings.map(mapping => {
          const lawShortName = mapping.laws.short_name
          const selectedArticles = selectedArticlesByLaw[lawShortName]

          if (selectedArticles && selectedArticles.length > 0) {
            const selectedArticlesAsStrings = selectedArticles.map(num => String(num))
            const filteredArticleNumbers = mapping.article_numbers.filter(articleNum =>
              selectedArticlesAsStrings.includes(String(articleNum))
            )

            return {
              ...mapping,
              article_numbers: filteredArticleNumbers
            }
          }

          return mapping
        }).filter(m => m.article_numbers.length > 0)
      }

      // 📚 APLICAR FILTRO DE SECCIONES/TÍTULOS
      if (selectedSectionFilters && selectedSectionFilters.length > 0) {
        const ranges = selectedSectionFilters
          .filter(s => s.articleRange)
          .map(s => ({ start: s.articleRange.start, end: s.articleRange.end, title: s.title }))

        if (ranges.length > 0) {
          console.log('📚 Aplicando filtro de secciones:', ranges.map(r => `${r.title} (${r.start}-${r.end})`).join(', '))

          filteredMappings = filteredMappings.map(mapping => {
            const filteredArticleNumbers = mapping.article_numbers.filter(articleNum => {
              const num = parseInt(articleNum)
              return ranges.some(range => num >= range.start && num <= range.end)
            })

            return {
              ...mapping,
              article_numbers: filteredArticleNumbers
            }
          }).filter(m => m.article_numbers.length > 0)
        }
      }

      console.log('🔧 Mappings filtrados:', filteredMappings.length)

      // 4️⃣ Para cada ley, obtener preguntas
      let allQuestions = []

      for (const mapping of filteredMappings) {
        let query = supabase
          .from('questions')
          .select(`
            id, question_text, option_a, option_b, option_c, option_d,
            correct_option, explanation, difficulty, is_official_exam,
            primary_article_id, exam_source, exam_date, exam_entity,
            articles!inner(
              id, article_number, title, content,
              laws!inner(short_name, name)
            )
          `)
          .eq('is_active', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)

        // Filtrar solo oficiales si se solicita
        if (onlyOfficialQuestions) {
          query = query.eq('is_official_exam', true)
        }

        const { data: lawQuestions, error: questionsError } = await query

        if (!questionsError && lawQuestions) {
          allQuestions = [...allQuestions, ...lawQuestions]
        }
      }

      console.log('📚 Total preguntas obtenidas:', allQuestions.length)

      if (allQuestions.length === 0) {
        throw new Error('No se encontraron preguntas para esta configuración')
      }

      // 5️⃣ Mezclar y limitar según configuración
      let finalQuestions = [...allQuestions]

      // Shuffle
      finalQuestions = finalQuestions.sort(() => Math.random() - 0.5)

      // Limitar cantidad
      finalQuestions = finalQuestions.slice(0, numQuestions)

      console.log('✅ Preguntas finales para examen:', finalQuestions.length)

      setQuestions(finalQuestions)
      setLoading(false)

    } catch (error) {
      console.error('❌ Error cargando preguntas para examen:', error)
      setError(error.message)
      setLoading(false)
    }
  }

  // ✅ LOADING STATE
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

  // ✅ ERROR STATE
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
            href={`/auxiliar-administrativo-estado/test/tema/${temaNumber}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver al tema
          </a>
        </div>
      </div>
    )
  }

  // ✅ VALIDAR TEMA
  if (isNaN(temaNumber) || temaNumber < 1 || (temaNumber > 16 && temaNumber < 101) || temaNumber > 200) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Válido
          </h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber} no es válido.
          </p>
          <a
            href="/auxiliar-administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a todos los temas
          </a>
        </div>
      </div>
    )
  }

  // ✅ EXTRAER CONFIGURACIÓN
  const testConfig = {
    numQuestions: parseInt(searchParams.get('n')) || 25,
    onlyOfficialQuestions: searchParams.get('only_official') === 'true',
    difficultyMode: searchParams.get('difficulty_mode') || 'random',
    timeLimit: searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')) : null
  }

  // ✅ RENDERIZAR EXAMEN
  return (
    <ExamLayout
      tema={temaNumber}
      testNumber={null}
      config={testConfig}
      questions={questions}
      // 🆕 Props para reanudar examen
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando examen...</p>
        </div>
      </div>
    }>
      <TestExamenContent params={params} />
    </Suspense>
  )
}
