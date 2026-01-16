// components/LawTestPageWrapper.tsx - WRAPPER ESPECÍFICO PARA TESTS POR LEY
// 🚀 v2: Usa API /api/questions/filtered (Drizzle ORM) en lugar de lawFetchers
'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import TestLayout from './TestLayout'
import OposicionDetector from './OposicionDetector'

// Tipos
type TestType = 'rapido' | 'avanzado' | 'oficial' | 'aleatorio'

interface Question {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option?: number
  explanation?: string
  primary_article_id?: string
  [key: string]: unknown
}

interface TestConfig {
  name: string
  description: string
  color: string
  icon: string
  subtitle: string
  tema: number
  isLawTest?: boolean
  lawShortName?: string
  numQuestions?: number
  onlyOfficial?: boolean
  customNavigationLinks?: {
    backToLaw?: {
      href: string
      label: string
      isPrimary: boolean
    }
    backToTests?: {
      href: string
      label: string
      isPrimary: boolean
    }
    backToTemario?: {
      href: string
      label: string
      isPrimary: boolean
    }
  }
}

// 🚀 Interfaz para respuesta de API v2
interface FilteredQuestionResponse {
  id: string
  question: string
  options: [string, string, string, string]
  explanation: string
  primary_article_id: string
  tema: number | null
  article: {
    id: string
    number: string
    title: string | null
    full_text: string | null
    law_name: string
    law_short_name: string
    display_number: string
  }
  metadata: {
    id: string
    difficulty: string
    question_type: string
    tags: string[] | null
    is_active: boolean
    created_at: string | null
    updated_at: string | null
    is_official_exam: boolean | null
    exam_source: string | null
    exam_date: string | null
    exam_entity: string | null
    exam_position: string | null
    official_difficulty_level: string | null
  }
}

// 🔄 Transformar respuesta de API v2 al formato que espera TestLayout
function transformApiResponse(apiQuestions: FilteredQuestionResponse[]): Question[] {
  return apiQuestions.map(q => ({
    id: q.id,
    // TestLayout usa tanto 'question' como 'question_text' en diferentes lugares
    question: q.question,
    question_text: q.question,
    option_a: q.options[0],
    option_b: q.options[1],
    option_c: q.options[2],
    option_d: q.options[3],
    // TestLayout también usa 'options' array en algunos lugares
    options: q.options,
    explanation: q.explanation,
    primary_article_id: q.primary_article_id,
    is_official_exam: q.metadata.is_official_exam,
    exam_source: q.metadata.exam_source,
    exam_date: q.metadata.exam_date,
    exam_entity: q.metadata.exam_entity,
    difficulty: q.metadata.difficulty,
    question_type: q.metadata.question_type,
    tags: q.metadata.tags,
    // 📄 Estructura 'article' (singular) para testAnswers.js
    article: {
      id: q.article.id,
      number: q.article.number,
      law_short_name: q.article.law_short_name,
      law_name: q.article.law_name,
      title: q.article.title,
      full_text: q.article.full_text,
    },
    // 📚 Estructura 'articles' (plural) para TestLayout
    articles: {
      id: q.article.id,
      article_number: q.article.number,
      title: q.article.title,
      content: q.article.full_text,
      laws: {
        short_name: q.article.law_short_name,
        name: q.article.law_name,
      }
    }
  }))
}

interface LawTestPageWrapperProps {
  // Props obligatorias para tests de ley
  lawShortName: string
  lawSlug: string
  testType: TestType

  // Props de personalización (opcionales)
  customTitle?: string
  customDescription?: string
  customIcon?: string
  customColor?: string
  customSubtitle?: string

  // Props de configuración (opcionales)
  defaultConfig?: Partial<TestConfig>

  // Props de UI (opcionales)
  loadingMessage?: string
  errorMessage?: string
}

export default function LawTestPageWrapper({
  lawShortName,
  lawSlug,
  testType,
  customTitle,
  customDescription,
  customIcon,
  customColor,
  customSubtitle,
  defaultConfig = {},
  loadingMessage,
  errorMessage
}: LawTestPageWrapperProps) {
  // Estados básicos
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<TestConfig | null>(null)
  const [temarioReturnUrl, setTemarioReturnUrl] = useState<string | null>(null)

  // Hook de Next.js para searchParams
  const searchParams = useSearchParams()
  const sourceParam = searchParams?.get('source')

  // 📚 Leer URL de temario desde sessionStorage si viene de temario
  useEffect(() => {
    if (sourceParam === 'temario' && typeof window !== 'undefined') {
      const storedUrl = sessionStorage.getItem('temario_return_url')
      if (storedUrl) {
        setTemarioReturnUrl(storedUrl)
        console.log('📚 [LAW WRAPPER] Temario return URL found:', storedUrl)
      }
    }
  }, [sourceParam])

  // 🔥 Configuraciones predefinidas por tipo de test (v2 - sin fetchers legacy)
  const getTestConfig = (): TestConfig => {
    const numQuestionsParam = parseInt(searchParams?.get('n') || '0')

    const baseConfigs: Record<TestType, TestConfig> = {
      rapido: {
        name: "Test Rápido",
        description: "Práctica rápida",
        color: "from-green-500 to-emerald-600",
        icon: "⚡",
        subtitle: "10 preguntas en 5 minutos",
        tema: 0,
        numQuestions: numQuestionsParam || 10,
        onlyOfficial: false
      },
      avanzado: {
        name: "Test Avanzado",
        description: "Test completo",
        color: "from-blue-500 to-indigo-600",
        icon: "🎯",
        subtitle: "25+ preguntas para dominar el tema",
        tema: 0,
        numQuestions: numQuestionsParam || 25,
        onlyOfficial: false
      },
      oficial: {
        name: "Test Oficial",
        description: "Preguntas de exámenes reales",
        color: "from-red-500 to-pink-600",
        icon: "🏛️",
        subtitle: "Solo preguntas que aparecieron en exámenes oficiales",
        tema: 0,
        numQuestions: numQuestionsParam || 25,
        onlyOfficial: true
      },
      aleatorio: {
        name: "Test Aleatorio",
        description: "Preguntas mezcladas",
        color: "from-blue-500 to-cyan-600",
        icon: "🎲",
        subtitle: "Orden completamente aleatorio",
        tema: 0,
        numQuestions: numQuestionsParam || 25,
        onlyOfficial: false
      }
    }

    const baseConfig = baseConfigs[testType] || baseConfigs.aleatorio

    // 🎯 Sobrescribir con props personalizadas
    const finalConfig: TestConfig = {
      ...baseConfig,
      name: customTitle || baseConfig.name,
      description: customDescription || baseConfig.description,
      color: customColor || baseConfig.color,
      icon: customIcon || baseConfig.icon,
      subtitle: customSubtitle || baseConfig.subtitle,
      ...defaultConfig
    }

    console.log('🔧 [LAW WRAPPER v2] Config generado:', finalConfig)
    return finalConfig
  }

  // 🔧 Función para obtener número de test
  const getTestNumber = (type: TestType): number => {
    const testNumbers: Record<TestType, number> = {
      rapido: 2,
      avanzado: 4,
      oficial: 3,
      aleatorio: 1
    }
    return testNumbers[type] || 1
  }

  // 🚀 Función principal de carga (v2 - usa API /api/questions/filtered)
  const loadQuestions = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🚀 [LAW WRAPPER v2] Cargando test', testType, 'para ley:', lawShortName)

      const testConfig = getTestConfig()
      console.log('🔧 [LAW WRAPPER v2] Config:', testConfig)
      setConfig(testConfig)

      // 📄 Parsear artículos seleccionados desde searchParams
      const selectedArticlesParam = searchParams?.get('selected_articles')
      let selectedArticlesByLaw: Record<string, number[]> = {}

      if (selectedArticlesParam) {
        const articleNumbers = selectedArticlesParam
          .split(',')
          .map(art => parseInt(art.trim()))
          .filter(num => !isNaN(num))

        if (articleNumbers.length > 0) {
          selectedArticlesByLaw = { [lawShortName]: articleNumbers }
          console.log('📄 [LAW WRAPPER v2] Artículos seleccionados:', selectedArticlesByLaw)
        }
      }

      // 🚀 Construir request para API v2
      const apiRequest = {
        topicNumber: 0, // Sin filtro de tema (modo ley-only)
        positionType: 'auxiliar_administrativo' as const,
        numQuestions: testConfig.numQuestions || 25,
        selectedLaws: [lawShortName],
        selectedArticlesByLaw,
        onlyOfficialQuestions: testConfig.onlyOfficial || false,
      }

      console.log('📊 [LAW WRAPPER v2] Request a API:', apiRequest)

      // 🔥 Llamar a la API v2
      const response = await fetch('/api/questions/filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequest),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || `No se encontraron preguntas para ${lawShortName}`)
      }

      if (!data.questions || data.questions.length === 0) {
        const articleInfo = Object.keys(selectedArticlesByLaw).length > 0
          ? ` para los artículos ${Object.values(selectedArticlesByLaw).flat().join(', ')}`
          : ''
        throw new Error(`No hay preguntas disponibles${articleInfo}. Prueba con otros artículos.`)
      }

      // 🔄 Transformar respuesta al formato que espera TestLayout
      const transformedQuestions = transformApiResponse(data.questions)

      console.log('✅ [LAW WRAPPER v2] Preguntas cargadas:', {
        total: transformedQuestions.length,
        totalAvailable: data.totalAvailable,
        filtersApplied: data.filtersApplied
      })

      setQuestions(transformedQuestions)

    } catch (err) {
      console.error('❌ [LAW WRAPPER v2] Error cargando test:', err)
      setError(err instanceof Error ? err.message : 'Error cargando el test')
    } finally {
      setLoading(false)
    }
  }

  // 🔄 Cargar preguntas al montar y cuando cambien los parámetros
  useEffect(() => {
    if (lawShortName) {
      loadQuestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawShortName, testType, searchParams])

  // 🔄 Estado de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {loadingMessage || `🔄 Preparando ${config?.name || 'test'} de ${lawShortName}...`}
          </p>
          {config && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {config.icon} {config.name}
            </p>
          )}

          {/* Información específica para tests de ley */}
          <div className="mt-3 space-y-1 text-xs text-green-600 dark:text-green-400">
            <p>🏛️ Test de ley específica</p>
            <p>📚 Ley: {lawShortName}</p>
            <p>⚙️ Tipo: {testType}</p>
            <p>🔧 Usando lawFetchers especializados</p>
          </div>
        </div>
      </div>
    )
  }

  // ❌ Estado de error
  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-3">
              {config?.icon || '⚠️'} Test de {lawShortName} No Disponible
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-3 text-sm">
              {errorMessage || error || `No se encontraron preguntas para ${lawShortName} con esta configuración.`}
            </p>

            {/* Información del test de ley */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4 text-left">
              <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2">Configuración del test:</h4>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <li>📚 Ley: {lawShortName}</li>
                <li>⚙️ Tipo de test: {testType}</li>
                <li>📝 Preguntas solicitadas: {searchParams?.get('n') || 'Default'}</li>
                {searchParams?.get('only_official') === 'true' && (
                  <li>🏛️ Solo preguntas oficiales</li>
                )}
              </ul>
            </div>

            <div className="space-y-3">
              <button
                onClick={loadQuestions}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm w-full"
              >
                🔄 Reintentar
              </button>

              {/* Botones alternativos para la misma ley */}
              <div className="grid grid-cols-2 gap-2">
                {testType !== 'rapido' && (
                  <a
                    href="?n=10"
                    className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-xs text-center"
                  >
                    ⚡ Test Rápido
                  </a>
                )}
                {testType !== 'avanzado' && (
                  <a
                    href="?n=25"
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs text-center"
                  >
                    🎯 Test Avanzado
                  </a>
                )}
              </div>

              <a
                href="/leyes"
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm inline-block w-full text-center"
              >
                📚 Ver Todas las Leyes
              </a>

              <a
                href={`/leyes/${lawSlug}`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm inline-block w-full text-center underline"
              >
                🏠 Volver a {lawShortName}
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ✅ Renderizar test exitoso
  return (
    <>
      <OposicionDetector />

      <TestLayout
        tema={config?.tema || 0}
        testNumber={getTestNumber(testType)}
        config={{
          ...(config || {
            name: `Test ${testType} ${lawShortName}`,
            description: `Test de ${lawShortName}`,
            icon: '🏛️',
            color: 'from-blue-500 to-cyan-600',
            subtitle: `${questions.length} preguntas`,
            tema: 0
          }),
          // Sobrescribir con número real de preguntas
          description: `${questions.length} preguntas para dominar ${lawShortName}`,
          subtitle: `${questions.length} preguntas de ${lawShortName}`,
          // ✅ AÑADIR CONFIGURACIÓN ESPECÍFICA PARA NAVEGACIÓN DE LEYES
          isLawTest: true,
          lawShortName: lawShortName,
          customNavigationLinks: {
            backToLaw: {
              href: `/leyes/${lawSlug}`,
              label: `📚 Volver a ${lawShortName}`,
              isPrimary: true
            },
            backToTests: {
              href: `/leyes`,
              label: `📚 Tests de Otras Leyes`,
              isPrimary: false
            },
            ...(temarioReturnUrl && {
              backToTemario: {
                href: temarioReturnUrl,
                label: `📖 Volver a mi temario`,
                isPrimary: true
              }
            })
          }
        }}
        questions={questions}
        children={null}
      />
    </>
  )
}
