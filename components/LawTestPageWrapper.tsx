// components/LawTestPageWrapper.tsx - WRAPPER ESPECÍFICO PARA TESTS POR LEY
'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, ReadonlyURLSearchParams } from 'next/navigation'
import TestLayout from './TestLayout'
import OposicionDetector from './OposicionDetector'

// 🏛️ IMPORTS ESPECÍFICOS PARA TESTS POR LEY
import {
  fetchQuestionsByLaw,
  fetchLawQuickTest,
  fetchLawAdvancedTest,
  fetchLawOfficialTest
} from '../lib/lawFetchers'

// Tipos
type TestType = 'rapido' | 'avanzado' | 'oficial' | 'aleatorio'

type FetcherFunction = (
  lawShortName: string,
  searchParams: ReadonlyURLSearchParams | null,
  config: TestConfig
) => Promise<Question[]>

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
  fetcher?: FetcherFunction
  tema: number
  isLawTest?: boolean
  lawShortName?: string
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

  // 🔥 Configuraciones predefinidas por tipo de test
  const getTestConfig = (): TestConfig => {
    const baseConfigs: Record<TestType, TestConfig> = {
      rapido: {
        name: "Test Rápido",
        description: "Práctica rápida",
        color: "from-green-500 to-emerald-600",
        icon: "⚡",
        subtitle: "10 preguntas en 5 minutos",
        fetcher: fetchLawQuickTest as unknown as FetcherFunction,
        tema: 0
      },
      avanzado: {
        name: "Test Avanzado",
        description: "Test completo",
        color: "from-blue-500 to-indigo-600",
        icon: "🎯",
        subtitle: "25+ preguntas para dominar el tema",
        fetcher: fetchLawAdvancedTest as unknown as FetcherFunction,
        tema: 0
      },
      oficial: {
        name: "Test Oficial",
        description: "Preguntas de exámenes reales",
        color: "from-red-500 to-pink-600",
        icon: "🏛️",
        subtitle: "Solo preguntas que aparecieron en exámenes oficiales",
        fetcher: fetchLawOfficialTest as unknown as FetcherFunction,
        tema: 0
      },
      aleatorio: {
        name: "Test Aleatorio",
        description: "Preguntas mezcladas",
        color: "from-blue-500 to-cyan-600",
        icon: "🎲",
        subtitle: "Orden completamente aleatorio",
        fetcher: fetchQuestionsByLaw as unknown as FetcherFunction,
        tema: 0
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

    console.log('🔧 [LAW WRAPPER] Config generado:', finalConfig)
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

  // 🚀 Función principal de carga
  const loadQuestions = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🚀 [LAW WRAPPER] Cargando test', testType, 'para ley:', lawShortName)

      const testConfig = getTestConfig()
      console.log('🔧 [LAW WRAPPER] Config generado:', testConfig)
      setConfig(testConfig)

      // 🎯 Usar fetcher específico para leyes
      const fetcher = testConfig.fetcher

      if (!fetcher) {
        throw new Error(`No hay fetcher configurado para el tipo de test: ${testType}`)
      }

      console.log('📊 [LAW WRAPPER] Llamando fetcher:', {
        lawShortName,
        testType,
        fetcherName: fetcher.name,
        searchParams: Object.fromEntries(searchParams?.entries() || [])
      })

      // Llamar al fetcher específico
      const loadedQuestions = await fetcher(lawShortName, searchParams, testConfig)

      if (!loadedQuestions || loadedQuestions.length === 0) {
        throw new Error(`No se encontraron preguntas para ${lawShortName}`)
      }

      setQuestions(loadedQuestions)
      console.log('✅ [LAW WRAPPER] Test cargado exitosamente:', loadedQuestions.length, 'preguntas de', lawShortName)

    } catch (err) {
      console.error('❌ [LAW WRAPPER] Error cargando test:', err)
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
