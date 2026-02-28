// app/auxiliar-administrativo-madrid/test/test-aleatorio-examen/page.tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import ExamLayout from '@/components/ExamLayout'
import ExamLoadingIndicator from '@/components/ExamLoadingIndicator'
import { normalizeLawShortName } from '@/lib/lawMappingUtils'
import { OPOSICION_BLOCKS_CONFIG } from '@/lib/api/random-test/schemas'

const supabase = getSupabaseClient()

// Obtener nombres de temas desde la configuracion
const config = OPOSICION_BLOCKS_CONFIG['auxiliar-administrativo-madrid']
const themeNames: Record<number, string> = {}
config.blocks.forEach(block => {
  block.themes.forEach(theme => {
    themeNames[theme.id] = theme.name
  })
})

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
  laws?: {
    short_name: string
    name?: string
  }
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

function TestAleatorioExamenContent() {
  const searchParams = useSearchParams()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    currentPhase: 'connecting',
    currentMapping: 0,
    totalMappings: 0,
    currentLaw: '',
    questionsFound: 0,
    message: 'Conectando con la base de datos...',
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
  }, [])

  async function loadExamQuestions() {
    try {
      setLoading(true)
      setError(null)

      if (!testConfig.themes || testConfig.themes.length === 0) {
        throw new Error('No se han seleccionado temas para el test')
      }

      setLoadingProgress({
        currentPhase: 'fetching_mappings',
        currentMapping: 0,
        totalMappings: 0,
        currentLaw: '',
        questionsFound: 0,
        message: 'Obteniendo estructura de temas...',
      })

      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id, name),
          topics!inner(topic_number, position_type)
        `)
        .in('topics.topic_number', testConfig.themes)
        .eq('topics.position_type', 'auxiliar_administrativo_madrid')

      if (mappingError) throw mappingError
      if (!mappings || mappings.length === 0) {
        throw new Error('No se encontraron mapeos para los temas seleccionados')
      }

      setLoadingProgress(prev => ({
        ...prev,
        totalMappings: mappings.length,
        currentPhase: 'processing_laws',
        message: `Procesando ${mappings.length} combinaciones de leyes y temas...`,
      }))

      let allQuestions: Question[] = []
      let mappingIndex = 0

      for (const mapping of mappings) {
        mappingIndex++
        const normalizedLawName = normalizeLawShortName(mapping.laws?.short_name || '')

        setLoadingProgress(prev => ({
          ...prev,
          currentMapping: mappingIndex,
          currentLaw: normalizedLawName,
          message: `Buscando preguntas en ${normalizedLawName} (${mappingIndex}/${mappings.length})`,
        }))

        const hasSpecificArticles = mapping.article_numbers && mapping.article_numbers.length > 0

        try {
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
            .eq('articles.laws.short_name', normalizedLawName)

          if (hasSpecificArticles) {
            query = query.in('articles.article_number', mapping.article_numbers!)
          }

          if (testConfig.difficulty && testConfig.difficulty !== 'mixed') {
            query = query.eq('global_difficulty_category', testConfig.difficulty)
          }

          if (testConfig.onlyOfficialQuestions) {
            query = query.eq('is_official_exam', true)
          }

          const { data: lawQuestions, error: questionsError } = await query

          if (questionsError) {
            console.error(`Error con ley ${normalizedLawName}:`, questionsError.message)
          } else if (lawQuestions && lawQuestions.length > 0) {
            const questionsWithTopic = lawQuestions.map((q: Question) => ({
              ...q,
              source_topic: mapping.topics?.topic_number || 0,
            }))
            allQuestions = [...allQuestions, ...questionsWithTopic]

            setLoadingProgress(prev => ({
              ...prev,
              questionsFound: prev.questionsFound + lawQuestions.length,
            }))
          }
        } catch (err) {
          console.error(`Error procesando ley ${normalizedLawName}:`, err)
        }
      }

      if (allQuestions.length === 0) {
        throw new Error('No se encontraron preguntas con los criterios seleccionados')
      }

      setLoadingProgress({
        currentPhase: 'selecting',
        currentMapping: mappings.length,
        totalMappings: mappings.length,
        currentLaw: '',
        questionsFound: allQuestions.length,
        message: `Seleccionando ${testConfig.numQuestions} preguntas de ${allQuestions.length} disponibles...`,
      })

      let selectedQuestions: Question[] = []

      if (testConfig.themes.length > 1) {
        const questionsPerTheme = Math.floor(testConfig.numQuestions / testConfig.themes.length)
        const remainder = testConfig.numQuestions % testConfig.themes.length

        const questionsByTheme: Record<number, Question[]> = {}
        testConfig.themes.forEach(theme => {
          questionsByTheme[theme] = allQuestions.filter(q => q.source_topic === theme)
        })

        const sortedThemes = [...testConfig.themes].sort(
          (a, b) => questionsByTheme[b].length - questionsByTheme[a].length
        )

        const questionsNeeded: Record<number, number> = {}
        testConfig.themes.forEach(theme => {
          questionsNeeded[theme] = questionsPerTheme
          if (sortedThemes.indexOf(theme) < remainder) {
            questionsNeeded[theme]++
          }
        })

        testConfig.themes.forEach(theme => {
          const themeQuestions = questionsByTheme[theme]
          const needed = questionsNeeded[theme]
          const shuffled = [...themeQuestions].sort(() => Math.random() - 0.5)
          const selected = shuffled.slice(0, Math.min(needed, themeQuestions.length))
          selectedQuestions.push(...selected)
        })

        if (selectedQuestions.length < testConfig.numQuestions) {
          const remaining = allQuestions.filter(
            q => !selectedQuestions.some(sq => sq.id === q.id)
          )
          const shuffledRemaining = [...remaining].sort(() => Math.random() - 0.5)
          const additional = shuffledRemaining.slice(
            0,
            testConfig.numQuestions - selectedQuestions.length
          )
          selectedQuestions.push(...additional)
        }

        selectedQuestions = [...selectedQuestions].sort(() => Math.random() - 0.5)
      } else {
        const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
        selectedQuestions = shuffled.slice(0, testConfig.numQuestions)
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
          <a
            href="/auxiliar-administrativo-madrid/test/aleatorio"
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    const selectedThemeNames = testConfig.themes
      .map(id => themeNames[id])
      .filter(Boolean)

    return (
      <ExamLoadingIndicator
        numQuestions={testConfig.numQuestions}
        numThemes={testConfig.themes.length}
        themeNames={selectedThemeNames}
        progress={loadingProgress}
      />
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Error al Cargar Test</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/auxiliar-administrativo-madrid/test/aleatorio"
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  const selectedThemeNames = testConfig.themes
    .map(id => themeNames[id])
    .filter(Boolean)
    .join(', ')

  return (
    <ExamLayout
      tema={0}
      testNumber={1}
      config={{
        name: `Test Aleatorio - Modo Examen`,
        description: selectedThemeNames,
        subtitle: `${testConfig.themes.length} temas mezclados`,
        icon: '📝',
        color: 'from-red-500 to-red-600',
      }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      questions={questions as any}
    />
  )
}

export default function TestAleatorioExamenMadridPage() {
  return (
    <Suspense
      fallback={
        <ExamLoadingIndicator numQuestions={25} numThemes={1} themeNames={[]} />
      }
    >
      <TestAleatorioExamenContent />
    </Suspense>
  )
}
