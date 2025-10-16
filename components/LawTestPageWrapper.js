// components/LawTestPageWrapper.js - WRAPPER ESPECÍFICO PARA TESTS POR LEY
'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import TestLayout from './TestLayout'
import OposicionDetector from './OposicionDetector'

// 🏛️ IMPORTS ESPECÍFICOS PARA TESTS POR LEY
import {
  fetchQuestionsByLaw,
  fetchLawQuickTest,
  fetchLawAdvancedTest,
  fetchLawOfficialTest
} from '../lib/lawFetchers'

export default function LawTestPageWrapper({
  // 🎯 Props obligatorias para tests de ley
  lawShortName, // Ej: 'CE', 'LPAC', 'Ley 19/2013'
  lawSlug, // Ej: 'rdl-5-2015', 'ley-19-2013' - para navegación
  testType, // 'rapido', 'avanzado', 'oficial', 'aleatorio'
  
  // 🎯 Props de personalización (opcionales)
  customTitle,
  customDescription,
  customIcon,
  customColor,
  customSubtitle,
  
  // 🎯 Props de configuración (opcionales)
  defaultConfig = {},
  
  // 🎯 Props de UI (opcionales)
  loadingMessage,
  errorMessage
}) {
  // Estados básicos
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [config, setConfig] = useState(null)

  // Hook de Next.js para searchParams
  const searchParams = useSearchParams()

  // 🔥 Configuraciones predefinidas por tipo de test
  const getTestConfig = () => {
    const baseConfigs = {
      rapido: {
        name: "Test Rápido",
        description: "Práctica rápida",
        color: "from-green-500 to-emerald-600", 
        icon: "⚡",
        subtitle: "10 preguntas en 5 minutos",
        fetcher: fetchLawQuickTest,
        tema: 0 // Para LawTestPageWrapper, tema siempre es 0 (artículos dirigidos)
      },
      avanzado: {
        name: "Test Avanzado",
        description: "Test completo",
        color: "from-blue-500 to-indigo-600",
        icon: "🎯",
        subtitle: "25+ preguntas para dominar el tema",
        fetcher: fetchLawAdvancedTest,
        tema: 0
      },
      oficial: {
        name: "Test Oficial",
        description: "Preguntas de exámenes reales",
        color: "from-red-500 to-pink-600",
        icon: "🏛️", 
        subtitle: "Solo preguntas que aparecieron en exámenes oficiales",
        fetcher: fetchLawOfficialTest,
        tema: 0
      },
      aleatorio: {
        name: "Test Aleatorio",
        description: "Preguntas mezcladas",
        color: "from-blue-500 to-cyan-600",
        icon: "🎲",
        subtitle: "Orden completamente aleatorio",
        fetcher: fetchQuestionsByLaw,
        tema: 0
      }
    }

    const baseConfig = baseConfigs[testType] || baseConfigs.aleatorio
    
    // 🎯 Sobrescribir con props personalizadas
    const finalConfig = {
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
  const getTestNumber = (testType) => {
    const testNumbers = {
      rapido: 2,
      avanzado: 4,
      oficial: 3,
      aleatorio: 1
    }
    return testNumbers[testType] || 1
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
      const questions = await fetcher(lawShortName, searchParams, testConfig)

      if (!questions || questions.length === 0) {
        throw new Error(`No se encontraron preguntas para ${lawShortName}`)
      }

      setQuestions(questions)
      console.log('✅ [LAW WRAPPER] Test cargado exitosamente:', questions.length, 'preguntas de', lawShortName)

    } catch (err) {
      console.error('❌ [LAW WRAPPER] Error cargando test:', err)
      setError(err.message || 'Error cargando el test')
    } finally {
      setLoading(false)
    }
  }

  // 🔄 Cargar preguntas al montar y cuando cambien los parámetros
  useEffect(() => {
    if (lawShortName) {
      loadQuestions()
    }
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
                    href={`?n=10`} // Cambiar a test rápido
                    className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-xs text-center"
                  >
                    ⚡ Test Rápido
                  </a>
                )}
                {testType !== 'avanzado' && (
                  <a 
                    href={`?n=25`} // Cambiar a test avanzado
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
                href="/auxiliar-administrativo-estado/test"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm inline-block w-full text-center underline"
              >
                🏠 Volver a Tests por Tema
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
      
      {/* ✅ DEBUGGER específico para tests de ley */}
      {console.log('🔍 [LAW WRAPPER] Debug:', { 
        lawShortName,
        tema: config?.tema || 0, // Siempre 0 para tests dirigidos
        testNumber: getTestNumber(testType), 
        config, 
        questionsLength: questions.length,
        testType
      })}
      
      <TestLayout
        tema={config?.tema || 0} // Para tests de ley, tema es 0 (artículos dirigidos)
        testNumber={getTestNumber(testType)}
        config={{
          ...(config || {
            name: `Test ${testType} ${lawShortName}`,
            description: `Test de ${lawShortName}`,
            subtitle: `${questions.length} preguntas`,
            icon: '🏛️',
            color: 'from-blue-500 to-cyan-600'
          }),
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
            }
          }
        }}
        questions={questions}
      />
    </>
  )
}