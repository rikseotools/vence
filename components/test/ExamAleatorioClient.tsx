// components/test/ExamAleatorioClient.tsx
// Client component compartido para test aleatorio en modo examen.
// Recibe themeNames como prop desde server wrapper (fuente: BD).
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import ExamLayout from '@/components/ExamLayout'
import ExamLoadingIndicator from '@/components/ExamLoadingIndicator'
import { useLawSlugs } from '@/contexts/LawSlugContext'

const supabase = getSupabaseClient()

interface LoadingProgress {
  currentPhase: string
  currentMapping: number
  totalMappings: number
  currentLaw: string
  questionsFound: number
  message: string
}

interface QuestionArticle {
  id?: string
  article_number?: string
  title?: string | null
  content?: string | null
  laws?: { short_name: string; name?: string }
}

interface Question {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option?: number
  explanation?: string | null
  difficulty?: string | null
  is_official_exam?: boolean | null
  source_topic?: number
  tema_number?: number
  primary_article_id?: string
  articles?: QuestionArticle
}

interface ExamAleatorioClientProps {
  oposicionSlug: string
  positionType: string
  themeNames: Record<number, string>
}

function ExamAleatorioContent({ oposicionSlug, positionType, themeNames }: ExamAleatorioClientProps) {
  const { normalizeName } = useLawSlugs()
  const searchParams = useSearchParams()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    currentPhase: 'connecting', currentMapping: 0, totalMappings: 0,
    currentLaw: '', questionsFound: 0, message: 'Conectando con la base de datos...',
  })

  const testConfig = {
    numQuestions: parseInt(searchParams.get('n') || '25'),
    themes: searchParams.get('themes')?.split(',').map(t => parseInt(t)) || [],
    difficulty: searchParams.get('difficulty') || 'mixed',
    mode: searchParams.get('mode') || 'aleatorio',
    onlyOfficialQuestions: searchParams.get('official_only') === 'true',
    focusEssentialArticles: searchParams.get('focus_essential') === 'true',
    adaptiveMode: searchParams.get('adaptive') === 'true',
  }

  useEffect(() => {
    loadExamQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadExamQuestions() {
    try {
      setLoading(true)
      setError(null)

      if (!testConfig.themes || testConfig.themes.length === 0) {
        throw new Error('No se han seleccionado temas para el test')
      }

      setLoadingProgress(prev => ({ ...prev, currentPhase: 'fetching', message: 'Obteniendo preguntas...' }))

      // Migrado a API centralizada (/api/questions/filtered) para cerrar vector de scraping
      const difficultyMode = testConfig.difficulty === 'mixed' ? 'random' : testConfig.difficulty

      const response = await fetch('/api/questions/filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicNumber: 0,
          positionType,
          multipleTopics: testConfig.themes,
          numQuestions: Math.min(testConfig.numQuestions * 3, 500),
          selectedLaws: [],
          selectedArticlesByLaw: {},
          selectedSectionFilters: [],
          onlyOfficialQuestions: testConfig.onlyOfficialQuestions,
          difficultyMode,
          focusEssentialArticles: testConfig.focusEssentialArticles,
          proportionalByTopic: testConfig.themes.length > 1,
        })
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error obteniendo preguntas')
      }

      const allQuestions: Question[] = (data.questions || []).map((q: any) => ({
        id: q.id,
        question_text: q.question,
        option_a: q.options[0],
        option_b: q.options[1],
        option_c: q.options[2],
        option_d: q.options[3],
        correct_option: q.correct_option,
        explanation: q.explanation,
        difficulty: q.metadata?.difficulty || 'medium',
        is_official_exam: q.metadata?.is_official_exam || false,
        primary_article_id: q.primary_article_id,
        exam_source: q.metadata?.exam_source || null,
        exam_date: q.metadata?.exam_date || null,
        exam_entity: q.metadata?.exam_entity || null,
        articles: {
          id: q.article?.id,
          article_number: q.article?.number,
          title: q.article?.title,
          content: q.article?.full_text,
          laws: { short_name: q.article?.law_short_name, name: q.article?.law_name },
        },
        source_topic: q.tema || 0,
      }))

      if (allQuestions.length === 0) throw new Error('No se encontraron preguntas con los criterios seleccionados')

      setLoadingProgress({ currentPhase: 'selecting', currentMapping: 1, totalMappings: 1, currentLaw: '', questionsFound: allQuestions.length, message: `Seleccionando ${testConfig.numQuestions} preguntas de ${allQuestions.length} disponibles...` })

      let selectedQuestions: Question[] = []
      if (testConfig.themes.length > 1) {
        const questionsPerTheme = Math.floor(testConfig.numQuestions / testConfig.themes.length)
        const remainder = testConfig.numQuestions % testConfig.themes.length
        const questionsByTheme: Record<number, Question[]> = {}
        testConfig.themes.forEach(theme => { questionsByTheme[theme] = allQuestions.filter(q => q.source_topic === theme) })
        const sortedThemes = [...testConfig.themes].sort((a, b) => questionsByTheme[b].length - questionsByTheme[a].length)
        const questionsNeeded: Record<number, number> = {}
        testConfig.themes.forEach(theme => { questionsNeeded[theme] = questionsPerTheme + (sortedThemes.indexOf(theme) < remainder ? 1 : 0) })
        testConfig.themes.forEach(theme => {
          const shuffled = [...questionsByTheme[theme]].sort(() => Math.random() - 0.5)
          selectedQuestions.push(...shuffled.slice(0, Math.min(questionsNeeded[theme], questionsByTheme[theme].length)))
        })
        if (selectedQuestions.length < testConfig.numQuestions) {
          const remaining = allQuestions.filter(q => !selectedQuestions.some(sq => sq.id === q.id))
          selectedQuestions.push(...[...remaining].sort(() => Math.random() - 0.5).slice(0, testConfig.numQuestions - selectedQuestions.length))
        }
        selectedQuestions = [...selectedQuestions].sort(() => Math.random() - 0.5)
      } else {
        selectedQuestions = [...allQuestions].sort(() => Math.random() - 0.5).slice(0, testConfig.numQuestions)
      }

      setQuestions(selectedQuestions)
    } catch (err) {
      console.error('Error cargando preguntas para examen:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (!testConfig.themes || testConfig.themes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Configuracion No Valida</h1>
          <p className="text-gray-600 mb-6">No se han seleccionado temas para el test aleatorio.</p>
          <a href={`/${oposicionSlug}/test/aleatorio`} className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return <ExamLoadingIndicator numQuestions={testConfig.numQuestions} numThemes={testConfig.themes.length} themeNames={testConfig.themes.map(id => themeNames[id]).filter(Boolean)} progress={loadingProgress} />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Error al Cargar Test</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href={`/${oposicionSlug}/test/aleatorio`} className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  const selectedThemeNames = testConfig.themes.map(id => themeNames[id]).filter(Boolean).join(', ')

  return (
    <ExamLayout
      tema={0}
      testNumber={1}
      config={{
        name: 'Test Aleatorio - Modo Examen',
        description: selectedThemeNames,
        subtitle: `${testConfig.themes.length} temas mezclados`,
        icon: '📝',
        color: 'from-amber-500 to-amber-600',
      }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      questions={questions as any}
    />
  )
}

export default function ExamAleatorioClient(props: ExamAleatorioClientProps) {
  return (
    <Suspense fallback={<ExamLoadingIndicator numQuestions={25} numThemes={1} themeNames={[]} />}>
      <ExamAleatorioContent {...props} />
    </Suspense>
  )
}
