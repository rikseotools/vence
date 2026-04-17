// app/test/aleatorio-examen/page.js - Ruta genérica para test aleatorio en modo examen
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ExamLayout from '@/components/ExamLayout'
import ExamLoadingIndicator from '@/components/ExamLoadingIndicator'
import { fetchAleatorioMultiTema } from '@/lib/testFetchers'
import { useLawSlugs } from '@/contexts/LawSlugContext'
import { getOposicionConfig, getThemeNames } from '@/lib/config/oposiciones'

// Mapeo de exam_position por tipo de oposición
const EXAM_POSITION_MAP = {
  'auxiliar_administrativo': [
    'auxiliar administrativo del estado',
    'auxiliar administrativo',
    'auxiliar_administrativo',
    'auxiliar_administrativo_estado',
  ],
  'administrativo_estado': [
    'administrativo',
    'administrativo_estado',
    'cuerpo_general_administrativo',
    'cuerpo general administrativo de la administración del estado',
  ],
  'tramitacion_procesal': ['tramitacion_procesal', 'tramitación procesal'],
  'auxilio_judicial': ['auxilio_judicial', 'auxilio judicial'],
  'gestion_procesal': ['gestion_procesal', 'gestión procesal'],
}

function TestAleatorioExamenContent() {
  const { normalizeName } = useLawSlugs()
  const searchParams = useSearchParams()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [oposicionConfig, setOposicionConfig] = useState(null)
  const [loadingProgress, setLoadingProgress] = useState({
    currentPhase: 'connecting',
    currentMapping: 0,
    totalMappings: 0,
    currentLaw: '',
    questionsFound: 0,
    message: 'Conectando con la base de datos...'
  })

  // Estado para resume
  const resumeTestId = searchParams.get('resume')
  const [initialAnswers, setInitialAnswers] = useState(null)
  const [resumeConfig, setResumeConfig] = useState(null)

  // Extraer configuración de la URL
  const testConfig = {
    numQuestions: parseInt(searchParams.get('n')) || 25,
    themes: searchParams.get('themes')?.split(',').map(t => parseInt(t)) || [],
    difficulty: searchParams.get('difficulty') || 'mixed',
    mode: searchParams.get('mode') || 'aleatorio',
    oposicion: searchParams.get('oposicion') || 'auxiliar_administrativo_estado',
    onlyOfficialQuestions: searchParams.get('official_only') === 'true',
    focusEssentialArticles: searchParams.get('focus_essential') === 'true',
    adaptiveMode: searchParams.get('adaptive') === 'true'
  }

  // Si hay resume, cargar el test existente
  useEffect(() => {
    if (resumeTestId) {
      loadResumeTest()
    }
  }, [resumeTestId])

  async function loadResumeTest() {
    try {
      setLoading(true)
      setError(null)
      console.log('🔄 Reanudando test aleatorio:', resumeTestId)

      setLoadingProgress({
        currentPhase: 'resuming',
        currentMapping: 0,
        totalMappings: 0,
        currentLaw: '',
        questionsFound: 0,
        message: 'Cargando examen guardado...'
      })

      // Llamar a la API de resume
      const response = await fetch(`/api/exam/resume?testId=${resumeTestId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al cargar el examen')
      }

      console.log('✅ Test cargado, preguntas:', data.questions?.length)
      console.log('💾 Respuestas guardadas:', Object.keys(data.savedAnswers || {}).length)

      // Guardar configuración del test para mostrar
      setResumeConfig({
        title: 'Test Aleatorio - Continuación',
        totalQuestions: data.totalQuestions || data.questions?.length
      })

      // Convertir respuestas al formato esperado por ExamLayout
      if (data.savedAnswers && Object.keys(data.savedAnswers).length > 0) {
        setInitialAnswers(data.savedAnswers)
      }

      setQuestions(data.questions || [])
      setLoading(false)

    } catch (err) {
      console.error('❌ Error cargando test para resume:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  // Cargar configuración de la oposición (solo para tests nuevos)
  useEffect(() => {
    if (resumeTestId) return // Skip si es resume
    const config = getOposicionConfig(testConfig.oposicion)
    if (config) {
      setOposicionConfig(config)
    }
  }, [testConfig.oposicion, resumeTestId])

  useEffect(() => {
    if (resumeTestId) return // Skip si es resume
    if (oposicionConfig) {
      loadExamQuestions()
    }
  }, [oposicionConfig, resumeTestId])

  async function loadExamQuestions() {
    try {
      setLoading(true)
      setError(null)
      console.log('🚀 INICIANDO carga de preguntas para examen...')
      console.log('📋 Configuración:', testConfig)
      console.log('📚 Oposición:', oposicionConfig?.name)

      // Validar que haya temas seleccionados
      if (!testConfig.themes || testConfig.themes.length === 0) {
        throw new Error('No se han seleccionado temas para el test')
      }

      setLoadingProgress(prev => ({ ...prev, currentPhase: 'fetching', message: 'Obteniendo preguntas...' }))

      const difficultyMode = testConfig.difficulty === 'mixed' ? 'random' : testConfig.difficulty
      const response = await fetch('/api/questions/filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicNumber: 0,
          positionType: oposicionConfig.positionType,
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

      const allQuestions = (data.questions || []).map(q => ({
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
        articles: q.article ? {
          id: q.article.id,
          article_number: q.article.number,
          title: q.article.title,
          content: q.article.full_text,
          laws: { short_name: q.article.law_short_name, name: q.article.law_name },
        } : undefined,
        source_topic: q.tema || 0,
      }))

      if (allQuestions.length === 0) throw new Error('No se encontraron preguntas con los criterios seleccionados')

      setLoadingProgress({
        currentPhase: 'selecting',
        currentMapping: 1,
        totalMappings: 1,
        currentLaw: '',
        questionsFound: allQuestions.length,
        message: `Seleccionando ${testConfig.numQuestions} preguntas de ${allQuestions.length} disponibles...`
      })

      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
      const selectedQuestions = shuffled.slice(0, testConfig.numQuestions)

      console.log(`✅ Examen via API: ${selectedQuestions.length} preguntas de ${allQuestions.length} disponibles`)

      setQuestions(selectedQuestions)

    } catch (err) {
      console.error('❌ ERROR FATAL cargando preguntas para examen:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Obtener nombres de temas para mostrar
  const themeNames = oposicionConfig
    ? getThemeNames(oposicionConfig.id, testConfig.themes)
    : {}

  // Validar configuración (solo para tests nuevos, no para resume)
  if (!resumeTestId && (!testConfig.themes || testConfig.themes.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Configuración No Válida
          </h1>
          <p className="text-gray-600 mb-6">
            No se han seleccionado temas para el test aleatorio.
          </p>
          <a
            href="/test/aleatorio"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    const selectedThemeNames = testConfig.themes
      .map(id => themeNames[id])
      .filter(Boolean)

    return (
      <ExamLoadingIndicator
        numQuestions={resumeTestId ? (resumeConfig?.totalQuestions || 25) : testConfig.numQuestions}
        numThemes={resumeTestId ? 1 : testConfig.themes.length}
        themeNames={resumeTestId ? ['Reanudando examen...'] : selectedThemeNames}
        progress={loadingProgress}
      />
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Error al Cargar Test</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/test/aleatorio"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  const selectedThemeNamesText = testConfig.themes
    .map(id => themeNames[id])
    .filter(Boolean)
    .join(', ')

  // Configuración diferente para resume vs nuevo
  const examConfig = resumeTestId
    ? {
        name: resumeConfig?.title || 'Test Aleatorio - Continuación',
        description: 'Reanudando examen guardado',
        subtitle: `${questions.length} preguntas`,
        icon: '🔄',
        color: 'from-orange-500 to-red-600'
      }
    : {
        name: `Test Aleatorio - Modo Examen`,
        description: selectedThemeNamesText,
        subtitle: `${testConfig.themes.length} tema${testConfig.themes.length > 1 ? 's mezclados' : ''} • ${oposicionConfig?.shortName || ''}`,
        icon: '📝',
        color: 'from-orange-500 to-red-600'
      }

  return (
    <ExamLayout
      tema={0}
      testNumber={1}
      config={examConfig}
      questions={questions}
      resumeTestId={resumeTestId}
      initialAnswers={initialAnswers}
    />
  )
}

export default function TestAleatorioExamenPage() {
  return (
    <Suspense fallback={
      <ExamLoadingIndicator
        numQuestions={25}
        numThemes={1}
        themeNames={[]}
      />
    }>
      <TestAleatorioExamenContent />
    </Suspense>
  )
}
