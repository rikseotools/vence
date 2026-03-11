// components/TestPageWrapper.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { getOposicionSlugFromPathname } from '@/lib/config/oposiciones'
import { useOposicion } from '@/contexts/OposicionContext'
import TestLayout from './TestLayout'
import OposicionDetector from './OposicionDetector'
import OposicionGuard from './OposicionGuard'
import {
  fetchRandomQuestions,
  fetchQuickQuestions,
  fetchOfficialQuestions,
  fetchPersonalizedQuestions,
  fetchQuestionsByTopicScope,  // 🎯 Para temas multi-ley (legacy)
  fetchQuestionsViaAPI,        // 🚀 NUEVO: API centralizada Drizzle + Zod
  fetchArticulosDirigido,      // 🆕 Para artículos dirigidos
  fetchMantenerRacha,          // 🆕 Para mantener rachas
  fetchExplorarContenido,      // 🆕 Para explorar contenido
  fetchAleatorioMultiTema,     // 🎲 Para tests aleatorios con múltiples temas
  fetchContentScopeQuestions   // 📋 Para content_scope
} from '../lib/testFetchers'

interface ContentScopeConfig {
  articleIds: string[]
  sectionInfo: { name: string; [key: string]: unknown }
}

interface TestPageWrapperProps {
  tema?: number | null
  testType: string
  customTitle?: string
  customDescription?: string
  customIcon?: string
  customColor?: string
  customSubtitle?: string
  defaultConfig?: Record<string, any>
  customQuestionFetcher?: string | null
  lawName?: string
  searchParams?: any
  themes?: number[]
  contentScopeConfig?: ContentScopeConfig
  positionType?: string
  loadingMessage?: string
  errorMessage?: string
}

export default function TestPageWrapper({
  tema,
  testType,
  customTitle,
  customDescription,
  customIcon,
  customColor,
  customSubtitle,
  defaultConfig = {},
  customQuestionFetcher = null,
  lawName,
  searchParams: propsSearchParams,
  themes,
  contentScopeConfig,
  positionType,
  loadingMessage,
  errorMessage
}: TestPageWrapperProps) {
  // Guard: bloquear tests si no tiene oposición seleccionada
  const { hasOposicion, loading: oposicionLoading } = useOposicion()

  // Estados básicos
  const [questions, setQuestions] = useState<any>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<any>(null)

  // 🎯 Estados para loading dinámico
  const [loadedCount, setLoadedCount] = useState(0)
  const [totalToLoad, setTotalToLoad] = useState(0)
  const [internalLoadingMessage, setInternalLoadingMessage] = useState('')

  // 🔒 Control de ejecución única para prevenir double-fetch
  const [loadingKey, setLoadingKey] = useState('')
  const loadingRef = useRef(false)

  // 🆕 USAR searchParams desde props si es de notificación, sino usar hook
  const hookSearchParams = useSearchParams()
  const pathname = usePathname()
  const finalSearchParams = propsSearchParams || hookSearchParams

 // 🎯 Función para detectar fetcher correcto según el tema
  const getFetcherForTema = (temaParam: number | null | undefined, testTypeParam: string, hasLawFilters = false) => {
    // 🎲 Para tests aleatorios multi-tema
    if (testTypeParam === 'aleatorio' && themes && themes.length > 0) {
      console.log(`🎲 Test aleatorio multi-tema: ${themes.length} temas`)
      return fetchAleatorioMultiTema
    }

    // 🚀 NUEVO: Usar API centralizada para tests personalizados con tema
    // La API maneja filtros de leyes, artículos y secciones via Drizzle + Zod
    if (temaParam && temaParam > 0 && testTypeParam === 'personalizado') {
      console.log(`🚀 Tema ${temaParam} usando API centralizada (Drizzle + Zod)`)
      return fetchQuestionsViaAPI
    }

    // Para otros tests con tema, usar fetcher legacy (funciona bien)
    if (temaParam && temaParam > 0) {
      return fetchQuestionsByTopicScope
    }

    // 🆕 Para tests sin tema pero con filtros de leyes específicas
    if (!temaParam && hasLawFilters && testTypeParam === 'personalizado') {
      console.log(`🎯 Test personalizado sin tema pero con filtros de leyes`)
      return fetchQuestionsViaAPI
    }

    // Para tests sin tema específico, usar fetchers específicos por tipo
    const generalFetchers: Record<string, any> = {
      aleatorio: fetchRandomQuestions,
      personalizado: fetchPersonalizedQuestions,
      rapido: fetchQuickQuestions,
      oficial: fetchOfficialQuestions
    }

    console.log(`⚡ Test general sin tema específico`)
    return generalFetchers[testTypeParam] || fetchRandomQuestions
  }

  // 🔥 Configuraciones predefinidas por tipo de test
  const getTestConfig = () => {
    const baseConfigs: Record<string, any> = {
      aleatorio: {
        name: "Test Aleatorio",
        description: "Preguntas mezcladas automáticamente",
        color: "from-blue-500 to-cyan-600",
        icon: "🎲",
        subtitle: "Orden completamente aleatorio",
        fetcher: getFetcherForTema(tema, 'aleatorio', false) // 🎯 DETECCIÓN AUTOMÁTICA
      },
      personalizado: {
        name: "Test Personalizado",
        description: " ",
        color: "from-blue-600 to-blue-700",
        icon: "✨",
        fetcher: getFetcherForTema(tema, 'personalizado', !!(defaultConfig?.selectedLaws?.length)) // 🎯 DETECCIÓN AUTOMÁTICA
      },
      rapido: {
        name: "Test Rápido",
        description: "Solo 10 preguntas",
        color: "from-green-500 to-emerald-600",
        icon: "⚡",
        subtitle: "Práctica rápida en 5 minutos",
        fetcher: getFetcherForTema(tema, 'rapido', false) // 🎯 DETECCIÓN AUTOMÁTICA
      },
      oficial: {
        name: "Test Oficial",
        description: "Solo preguntas de exámenes oficiales",
        color: "from-red-500 to-pink-600",
        icon: "🏛️",
        subtitle: "Preguntas que aparecieron en exámenes oficiales",
        fetcher: getFetcherForTema(tema, 'oficial', false) // 🎯 DETECCIÓN AUTOMÁTICA
      },
      // 🆕 NUEVOS TIPOS PARA NOTIFICACIONES
      'articulos-dirigido': {
        name: "Test Dirigido",
        description: "Artículos problemáticos",
        color: "from-red-500 to-pink-600",
        icon: "🎯",
        subtitle: "Enfocado en tus áreas de mejora",
        fetcher: fetchArticulosDirigido // ✅ USAR FUNCIÓN ESPECÍFICA
      },
      'mantener-racha': {
        name: "Mantener Racha",
        description: "Test para continuar estudiando",
        color: "from-yellow-500 to-orange-600",
        icon: "🔥",
        subtitle: "Mantén tu racha de estudio activa",
        fetcher: fetchMantenerRacha
      },
      'explorar': {
        name: "Explorar Contenido",
        description: "Nuevo contenido añadido",
        color: "from-blue-500 to-cyan-600",
        icon: "🔍",
        subtitle: "Descubre las últimas preguntas",
        fetcher: fetchExplorarContenido
      },
      // 📋 NUEVO TIPO PARA CONTENT_SCOPE
      'content_scope': {
        name: "Test Content Scope",
        description: "Preguntas específicas por materia",
        color: "from-emerald-500 to-teal-600",
        icon: "📋",
        subtitle: "Test basado en artículos específicos",
        fetcher: fetchContentScopeQuestions
      }
    }

    const baseConfig = baseConfigs[testType] || baseConfigs.aleatorio

    // 🎯 Sobrescribir con props personalizadas
    const finalConfig = {
      ...baseConfig,
      name: customTitle || baseConfig.name,
      description: customDescription !== undefined ? customDescription : baseConfig.description,
      color: customColor || baseConfig.color,
      icon: customIcon || baseConfig.icon,
      subtitle: customSubtitle !== undefined ? customSubtitle : baseConfig.subtitle,
      ...defaultConfig
    }

    // console.log('🔧 getTestConfig resultado:', finalConfig)
    return finalConfig
  }

  // 🔧 Función para obtener número de test
  const getTestNumber = (testTypeParam: string) => {
    const testNumbers: Record<string, number> = {
      aleatorio: 1,
      personalizado: 99,
      rapido: 2,
      oficial: 3,
      // 🆕 NUEVOS NÚMEROS PARA NOTIFICACIONES
      'articulos-dirigido': 88,
      'mantener-racha': 87,
      'explorar': 86,
      // 📋 NUEVO NÚMERO PARA CONTENT_SCOPE
      'content_scope': 85
    }
    return testNumbers[testTypeParam] || 1
  }

  // 🚀 Función principal de carga
  const loadQuestions = async () => {
    // 🔒 Generar clave única para esta ejecución
    const currentKey = `${tema}-${testType}-${Date.now()}`

    // 🔒 Prevenir ejecuciones múltiples simultáneas
    if (loadingRef.current) {
      console.log('🔒 TestPageWrapper: Ejecución ya en progreso, ignorando...')
      return
    }

    let loadingInterval: ReturnType<typeof setInterval> | undefined

    try {
      loadingRef.current = true
      setLoadingKey(currentKey)
      setLoading(true)
      setError(null)

      // 🎯 Inicializar progreso de carga
      const numQuestions = parseInt(finalSearchParams?.get?.('n') as string) || parseInt(defaultConfig?.numQuestions) || 10
      setTotalToLoad(numQuestions)
      setLoadedCount(0)

      // 🎯 Simular progreso de carga dinámico
      loadingInterval = setInterval(() => {
        setLoadedCount(prev => {
          if (prev < numQuestions) {
            return Math.min(prev + 1, numQuestions)
          }
          return prev
        })
      }, 100) // Incrementar cada 100ms

      console.log(`🚀 TestPageWrapper: Cargando test ${testType} para tema ${tema} [KEY: ${currentKey}]`)

      const testConfig = getTestConfig()
      // console.log('🔧 Config generado:', testConfig)
      setConfig(testConfig)

      // 🎯 Usar fetcher del tipo de test
      const fetcher = testConfig.fetcher

      if (!fetcher) {
        throw new Error(`No hay fetcher configurado para el tipo de test: ${testType}`)
      }

      let fetchedQuestions: any = []

      // 🆕 MANEJAR ARTICULOS-DIRIGIDO DE FORMA ESPECIAL
      if (testType === 'articulos-dirigido') {
        console.log('🎯 Cargando test dirigido con parámetros:', {
          lawName,
          searchParams: finalSearchParams,
          articles: finalSearchParams?.get?.('articles'),
          mode: finalSearchParams?.get?.('mode'),
          n: finalSearchParams?.get?.('n')
        })

        // Llamar fetchArticulosDirigido con parámetros específicos
        try {
          console.log('🔄 Llamando fetchArticulosDirigido con:', { lawName, finalSearchParams, testConfig })
          fetchedQuestions = await fetchArticulosDirigido(lawName!, finalSearchParams, testConfig)
          console.log('✅ fetchArticulosDirigido completado, preguntas:', fetchedQuestions?.length || 0)
        } catch (fetchError) {
          console.error('❌ Error en fetchArticulosDirigido:', fetchError)
          throw fetchError
        }
      } else if (testType === 'aleatorio' && themes && themes.length > 0) {
        // 🎲 MANEJAR TEST ALEATORIO MULTI-TEMA
        const multiTemaConfig = {
          ...testConfig,
          positionType: positionType || 'auxiliar_administrativo'
        }
        console.log('🎲 Cargando test aleatorio multi-tema con parámetros:', {
          themes,
          searchParams: finalSearchParams,
          numQuestions: finalSearchParams?.get?.('n'),
          difficulty: finalSearchParams?.get?.('difficulty'),
          positionType: multiTemaConfig.positionType
        })

        // Llamar fetchAleatorioMultiTema con temas específicos y positionType correcto
        fetchedQuestions = await fetchAleatorioMultiTema(themes, finalSearchParams, multiTemaConfig)
      } else if (testType === 'content_scope') {
        // 📋 MANEJAR CONTENT_SCOPE DE FORMA ESPECIAL
        console.log('📋 Cargando test content_scope con config:', contentScopeConfig)

        if (!contentScopeConfig) {
          throw new Error('No se proporcionó configuración de content_scope')
        }

        // Llamar fetchContentScopeQuestions con configuración específica
        fetchedQuestions = await fetchContentScopeQuestions(testConfig, contentScopeConfig)
      } else {
        // Para otros tipos de test, usar el fetcher normal
        let finalTestConfig: any = {
          ...testConfig,
          positionType: positionType || 'auxiliar_administrativo'
        }

        // 🎯 PARA TESTS PERSONALIZADOS: Extraer filtros de URL y agregarlos al config
        if (testType === 'personalizado') {
          const selectedLawsParam = finalSearchParams?.get?.('selected_laws')
          const selectedArticlesByLawParam = finalSearchParams?.get?.('selected_articles_by_law')
          const selectedSectionFiltersParam = finalSearchParams?.get?.('selected_section_filters') // 📚 FILTRO DE TÍTULOS

          // 🔧 PRIORIZAR CONFIG DESDE PROPS (defaultConfig) SOBRE URL
          let selectedLaws = testConfig?.selectedLaws || []
          let selectedArticlesByLaw = testConfig?.selectedArticlesByLaw || {}
          let selectedSectionFilters = testConfig?.selectedSectionFilters || [] // 📚 FILTRO DE TÍTULOS

          // Solo usar parámetros de URL si no hay config desde props
          if (selectedLaws.length === 0 && selectedLawsParam) {
            try {
              selectedLaws = JSON.parse(selectedLawsParam)
              selectedArticlesByLaw = selectedArticlesByLawParam ? JSON.parse(selectedArticlesByLawParam) : {}
            } catch (parseError) {
              console.error('❌ Error parsing filtros URL en TestPageWrapper:', parseError)
            }
          }

          // 📚 Parsear filtro de secciones desde URL si no está en config
          if (selectedSectionFilters.length === 0 && selectedSectionFiltersParam) {
            try {
              selectedSectionFilters = JSON.parse(selectedSectionFiltersParam)
              console.log('📚 Filtro de secciones parseado desde URL:', selectedSectionFilters.map((s: any) => s.title))
            } catch (parseError) {
              console.error('❌ Error parsing selectedSectionFilters URL:', parseError)
            }
          }

          // Agregar filtros al config que se pasa al fetcher
          finalTestConfig = {
            ...testConfig,
            selectedLaws,
            selectedArticlesByLaw,
            selectedSectionFilters, // 📚 FILTRO DE TÍTULOS
            positionType: positionType || 'auxiliar_administrativo'
          }

          if (selectedLaws.length > 0) {
            // console.log('🔧 Filtros aplicados desde', testConfig?.selectedLaws ? 'props' : 'URL', ':', selectedLaws.length, 'leyes,', Object.keys(selectedArticlesByLaw).length, 'grupos de artículos')
            // console.log('🎯 Leyes seleccionadas:', selectedLaws)
            // console.log('🎯 Artículos por ley:', selectedArticlesByLaw)
          }
        }

        fetchedQuestions = await fetcher(tema, finalSearchParams, finalTestConfig)
      }

      // 🧠 Verificar si es modo adaptativo o normal
      if (fetchedQuestions && fetchedQuestions.isAdaptive) {
        // Modo adaptativo - verificar estructura
        if (!fetchedQuestions.activeQuestions || fetchedQuestions.activeQuestions.length === 0) {
          throw new Error('No se encontraron preguntas activas para modo adaptativo')
        }
        setQuestions(fetchedQuestions) // Pasar toda la estructura adaptativa
        console.log('✅ TestPageWrapper: Modo adaptativo cargado:', fetchedQuestions.activeQuestions.length, 'activas,', fetchedQuestions.questionPool.length, 'en pool')
      } else {
        // Modo normal - verificar array
        if (!fetchedQuestions || fetchedQuestions.length === 0) {
          throw new Error('No se encontraron preguntas con la configuración actual')
        }
        setQuestions(fetchedQuestions)
        console.log('✅ TestPageWrapper: Test cargado exitosamente:', fetchedQuestions.length, 'preguntas')
      }
      console.log('✅ Config final aplicado:', testConfig)

      // 🎯 Detener interval y completar progreso
      clearInterval(loadingInterval)
      setLoadedCount(numQuestions)

      // 📝 Mostrar mensajes secuenciales con delays más largos
      setInternalLoadingMessage('📝 Procesando preguntas...')
      await new Promise(resolve => setTimeout(resolve, 300))

      setInternalLoadingMessage('🔧 Configurando test...')
      await new Promise(resolve => setTimeout(resolve, 300))

      setInternalLoadingMessage('⚡ Iniciando test...')
      await new Promise(resolve => setTimeout(resolve, 200))

    } catch (err: unknown) {
      console.error(`❌ TestPageWrapper: Error cargando test [KEY: ${currentKey}]:`, err)
      setError((err as Error).message || 'Error cargando el test')
      // Limpiar interval en caso de error
      if (loadingInterval) {
        clearInterval(loadingInterval)
      }
    } finally {
      // 🔒 Liberar lock de ejecución
      loadingRef.current = false
      setLoading(false)
      console.log(`🔓 TestPageWrapper: Carga finalizada [KEY: ${currentKey}]`)
    }
  }

  // 🔄 Cargar preguntas al montar y cuando cambien los parámetros
  useEffect(() => {
    loadQuestions()
  }, [tema, testType, finalSearchParams, lawName, themes]) // ✅ AGREGAR lawName y themes a dependencias

  // Guard: si no tiene oposición, mostrar selector antes del test
  if (!oposicionLoading && !hasOposicion) {
    return <OposicionGuard />
  }

  // 🔄 Estado de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
            {loadingMessage || `🔄 Preparando ${config?.name || 'test'}...`}
          </p>

          {/* 🎯 Contador dinámico de preguntas */}
          {totalToLoad > 0 && (
            <div className="mt-3">
              <p className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                {loadedCount}/{totalToLoad}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {internalLoadingMessage || (loadedCount < totalToLoad ? '📥 Cargando preguntas...' : '✅ Preguntas cargadas')}
              </p>
            </div>
          )}

          {config && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {config.icon} {config.name}
            </p>
          )}

          {/* Información específica según tipo */}
          {testType === 'personalizado' && (
            <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              {finalSearchParams?.get?.('exclude_recent') === 'true' && (
                <p>🚫 Excluyendo preguntas de últimos {finalSearchParams?.get?.('recent_days') || 15} días</p>
              )}
              {finalSearchParams?.get?.('only_official') === 'true' && (
                <p>🏛️ Solo preguntas de exámenes oficiales</p>
              )}
              {finalSearchParams?.get?.('focus_weak') === 'true' && (
                <p>🎯 Analizando áreas débiles</p>
              )}
            </div>
          )}

          {/* 🆕 INFORMACIÓN ESPECÍFICA PARA TESTS DIRIGIDOS */}
          {testType === 'articulos-dirigido' && (
            <div className="mt-3 space-y-1 text-xs text-red-600 dark:text-red-400">
              <p>🎯 Test dirigido cargando...</p>
              {lawName && <p>📚 Ley: {lawName}</p>}
              {finalSearchParams?.get?.('articles') && (
                <p>📋 Artículos: {(finalSearchParams.get('articles') as string).split(',').length}</p>
              )}
              {finalSearchParams?.get?.('mode') && (
                <p>⚙️ Modo: {finalSearchParams.get('mode')}</p>
              )}
              {finalSearchParams?.get?.('notification_id') && (
                <p>🔔 Desde notificación</p>
              )}
            </div>
          )}
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
              {config?.icon || '⚠️'} {config?.name || 'Test'} No Disponible
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-3 text-sm">
              {errorMessage || error || 'No se encontraron preguntas con esta configuración.'}
            </p>

            {/* 🆕 INFORMACIÓN ESPECIAL PARA ARTICULOS-DIRIGIDO */}
            {testType === 'articulos-dirigido' && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4 text-left">
                <h4 className="font-bold text-red-800 dark:text-red-300 text-sm mb-2">Test dirigido:</h4>
                <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                  {lawName && <li>📚 Ley: {lawName}</li>}
                  {finalSearchParams?.get?.('articles') && (
                    <li>📋 Artículos: {finalSearchParams.get('articles')}</li>
                  )}
                  {finalSearchParams?.get?.('mode') && (
                    <li>⚙️ Modo: {finalSearchParams.get('mode')}</li>
                  )}
                  {finalSearchParams?.get?.('n') && (
                    <li>📝 Preguntas solicitadas: {finalSearchParams.get('n')}</li>
                  )}
                </ul>
              </div>
            )}

            {/* Mostrar configuración actual si es personalizado */}
            {testType === 'personalizado' && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4 text-left">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2">Tu configuración:</h4>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <li>📝 Preguntas: {finalSearchParams?.get?.('n') || 25}</li>
                  <li>🎯 Dificultad: {finalSearchParams?.get?.('difficulty_mode') || 'aleatorio'}</li>
                  {finalSearchParams?.get?.('exclude_recent') === 'true' && (
                    <li>🚫 Excluir últimos {finalSearchParams?.get?.('recent_days') || 15} días</li>
                  )}
                  {finalSearchParams?.get?.('only_official') === 'true' && (
                    <li>🏛️ Solo preguntas oficiales</li>
                  )}
                  {finalSearchParams?.get?.('focus_weak') === 'true' && (
                    <li>🎯 Enfoque en áreas débiles</li>
                  )}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={loadQuestions}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm w-full"
              >
                🔄 Reintentar
              </button>

              {/* 🆕 BOTONES ESPECÍFICOS PARA ARTICULOS-DIRIGIDO */}
              {testType === 'articulos-dirigido' && lawName && (
                <>
                  <a
                    href={`/test/${encodeURIComponent(lawName)}/test-rapido?n=10`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm inline-block w-full text-center"
                  >
                    ⚡ Test rápido de {lawName}
                  </a>
                  <a
                    href={`/teoria/${lawName.toLowerCase().replace(/\s+/g, '-')}`}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm inline-block w-full text-center"
                  >
                    📖 Ver teoría de {lawName}
                  </a>
                </>
              )}

              {testType === 'personalizado' && tema && (
                <a
                  href={`/${getOposicionSlugFromPathname(pathname)}/test/tema/${tema}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm inline-block w-full text-center"
                >
                  🎛️ Cambiar configuración
                </a>
              )}

              {/* Solo mostrar test rápido general si no es un test de tema específico */}
              {!tema && (
                <a
                  href="/test/rapido"
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm inline-block w-full text-center"
                >
                  🎲 Test rápido general
                </a>
              )}

              <a
                href={`/${getOposicionSlugFromPathname(pathname)}/test`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm inline-block w-full text-center underline"
              >
                🏠 Volver a Tests
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

      {/* ✅ DEBUGGER: Mostrar valores actuales */}
      {console.log('🔍 TestPageWrapper debug:', {
        tema: tema || 0,
        testNumber: getTestNumber(testType),
        config,
        questionsLength: questions.length,
        testType
      })}

      <TestLayout
        tema={tema || 0}
        testNumber={getTestNumber(testType)}
        config={config || {
          name: `Test ${testType}`,
          description: 'Test de práctica',
          subtitle: `${questions.length} preguntas`,
          icon: '🎯',
          color: 'from-blue-500 to-cyan-600'
        }}
        questions={questions}
      />
    </>
  )
}
