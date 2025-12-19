'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// Spinner component
const Spinner = ({ size = 'sm' }) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div className={`animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 ${sizeClasses[size]}`} />
  )
}

// Funciones de comparación para el modal
const normalizeTextForModal = (text) => {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:()"'\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const calculateModalSimilarity = (text1, text2) => {
  const norm1 = normalizeTextForModal(text1)
  const norm2 = normalizeTextForModal(text2)

  if (!norm1 || !norm2) return 0
  if (norm1 === norm2) return 100

  const words1 = new Set(norm1.split(' ').filter(w => w.length > 2))
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 2))

  if (words1.size === 0 || words2.size === 0) return 0

  let common = 0
  for (const word of words1) {
    if (words2.has(word)) common++
  }

  return Math.round((common / Math.max(words1.size, words2.size)) * 100)
}

// Modal de comparación
const CompareModal = ({ isOpen, onClose, article, law, lawId }) => {
  const [boeContent, setBoeContent] = useState(null)
  const [dbContent, setDbContent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [similarity, setSimilarity] = useState({ title: 0, content: 0 })

  useEffect(() => {
    if (isOpen && article) {
      loadFullContent()
    }
  }, [isOpen, article])

  const loadFullContent = async () => {
    setLoading(true)
    setBoeContent(null)
    setDbContent(null)
    setSimilarity({ title: 0, content: 0 })

    try {
      // Añadir timestamp para evitar caché
      const timestamp = Date.now()
      const response = await fetch(
        `/api/verify-articles/compare?lawId=${lawId}&articleNumber=${article.article_number}&_t=${timestamp}`,
        { cache: 'no-store' }
      )
      const data = await response.json()
      if (data.success) {
        setBoeContent(data.boe)
        setDbContent(data.db)

        // Calcular similitud
        const titleSim = calculateModalSimilarity(data.boe?.title, data.db?.title)
        const contentSim = calculateModalSimilarity(data.boe?.content, data.db?.content)
        setSimilarity({ title: titleSim, content: contentSim })
      }
    } catch (err) {
      console.error('Error cargando contenido:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const isFullMatch = similarity.title >= 95 && similarity.content >= 95

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 my-8 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Comparar Artículo {article?.article_number}
                </h3>
                {!loading && isFullMatch && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full text-sm font-medium">
                    ✓ 100% idéntico
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {law?.short_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Similarity badges */}
          {!loading && boeContent && dbContent && (
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-3">
              <div className={`text-sm px-3 py-1 rounded-full font-medium ${
                similarity.title >= 95
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                  : similarity.title >= 70
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
              }`}>
                Título: {similarity.title}% similar
              </div>
              <div className={`text-sm px-3 py-1 rounded-full font-medium ${
                similarity.content >= 95
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                  : similarity.content >= 70
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
              }`}>
                Contenido: {similarity.content}% similar
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
                <span className="ml-3 text-gray-500">Cargando contenido...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* BOE */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full text-sm font-medium">
                      BOE Oficial
                    </span>
                    {law?.boe_url && (
                      <a
                        href={`${law.boe_url}#a${article?.article_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Ver en BOE →
                      </a>
                    )}
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                      {boeContent?.title || article?.boe_title || '(sin título)'}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {boeContent?.content || article?.boe_content_preview || 'Contenido no disponible'}
                    </p>
                  </div>
                </div>

                {/* BD */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full text-sm font-medium">
                      Base de Datos
                    </span>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                      {dbContent?.title || article?.db_title || article?.title || '(sin título)'}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {dbContent?.content || article?.db_content_preview || 'Contenido no disponible'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerificarArticulosPage() {
  const params = useParams()
  const router = useRouter()
  const lawId = params.lawId

  // Estados principales
  const [law, setLaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verificationResults, setVerificationResults] = useState(null)
  const [error, setError] = useState(null)

  // Estado para la última verificación guardada
  const [savedVerification, setSavedVerification] = useState(null)
  const [loadingSavedVerification, setLoadingSavedVerification] = useState(true)
  const [showSavedSummary, setShowSavedSummary] = useState(false)

  // Estado del flujo paso a paso
  const [currentStep, setCurrentStep] = useState(0)

  // Estados para selección de artículos
  const [selectedArticles, setSelectedArticles] = useState(new Set())
  const [articleQuestions, setArticleQuestions] = useState({})
  const [loadingQuestions, setLoadingQuestions] = useState({})

  // Estados para actualización de títulos
  const [updating, setUpdating] = useState(false)
  const [updateResults, setUpdateResults] = useState(null)

  // Estados para selección de preguntas para IA
  const [selectedQuestions, setSelectedQuestions] = useState(new Set())
  // Configuración de modelos cargada desde la API
  const [aiConfigs, setAiConfigs] = useState([])
  const [aiProvider, setAiProvider] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('verifyAiProvider') || 'anthropic'
    }
    return 'anthropic'
  })
  const [aiModel, setAiModel] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('verifyAiModel')
      // Lista de modelos válidos actuales
      const validModels = [
        'claude-3-haiku-20240307', 'claude-sonnet-4-20250514', 'claude-sonnet-4-5-20250929',
        'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo',
        'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'
      ]
      if (saved && validModels.includes(saved)) {
        return saved
      }
      // Si el modelo guardado no es válido, limpiar y usar default
      localStorage.removeItem('verifyAiModel')
      return 'claude-3-haiku-20240307'
    }
    return 'claude-3-haiku-20240307'
  })

  // Cargar configuración de modelos desde /admin/ai
  useEffect(() => {
    const loadAiConfigs = async () => {
      try {
        const response = await fetch('/api/admin/ai-config')
        const data = await response.json()
        if (data.success) {
          setAiConfigs(data.configs)
        }
      } catch (err) {
        console.error('Error cargando configuración IA:', err)
      }
    }
    loadAiConfigs()
  }, [])

  // Helper para obtener modelos del proveedor actual (solo los que funcionan)
  const getProviderModels = (provider, includeAll = false) => {
    const config = aiConfigs.find(c => c.provider === provider)
    const models = config?.available_models || []
    // Si includeAll, devolver todos. Si no, solo los que no han fallado
    if (includeAll) return models
    return models.filter(m => m.status !== 'failed')
  }

  // Helper para obtener TODOS los modelos (incluyendo fallidos, para mostrar en dropdown)
  const getAllProviderModels = (provider) => {
    const config = aiConfigs.find(c => c.provider === provider)
    return config?.available_models || []
  }

  // Guardar proveedor y modelo en localStorage cuando cambien
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('verifyAiProvider', aiProvider)
      // Si el modelo actual no pertenece al proveedor o está fallido, usar el primero que funcione
      const workingModels = getProviderModels(aiProvider)
      if (workingModels.length > 0) {
        const modelWorks = workingModels.some(m => m.id === aiModel)
        if (!modelWorks) {
          setAiModel(workingModels[0].id)
        }
      }
    }
  }, [aiProvider, aiConfigs])
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('verifyAiModel', aiModel)
    }
  }, [aiModel])
  const [verifyingWithAI, setVerifyingWithAI] = useState(false)
  const [aiResults, setAiResults] = useState({})

  // Filtros
  const [filter, setFilter] = useState('all') // all, title_mismatch, content_mismatch, extra_in_db, matching
  const [searchArticle, setSearchArticle] = useState('') // búsqueda por número de artículo
  const [similarityRange, setSimilarityRange] = useState([0, 100]) // [min, max] porcentaje de similitud

  // Modal de comparación
  const [compareArticle, setCompareArticle] = useState(null)

  // Verificación post-actualización
  const [postUpdateVerification, setPostUpdateVerification] = useState({})
  const [verifyingPostUpdate, setVerifyingPostUpdate] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState('verificacion') // 'verificacion' | 'verificar-preguntas' | 'reparar'
  const [historyData, setHistoryData] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all') // 'all' | 'pending' | 'ok' | 'problems'
  const [selectedHistoryArticles, setSelectedHistoryArticles] = useState(new Set()) // artículos seleccionados para verificar en lote
  const [batchVerifying, setBatchVerifying] = useState(false) // verificando en lote
  const [batchProgress, setBatchProgress] = useState({
    currentArticle: 0,
    totalArticles: 0,
    currentArticleNumber: null,
    questionsCompleted: 0,
    questionsTotal: 0,
    // Info de lotes dentro del artículo actual
    currentBatch: 0,
    totalBatches: 0,
    batchSize: 0,
    currentBatchQuestions: 0, // preguntas en el lote actual
    status: '' // mensaje de estado actual
  }) // progreso de verificación en lote
  const [batchResults, setBatchResults] = useState(null) // resultados finales de verificación en lote
  const [errorLogs, setErrorLogs] = useState(null) // logs de errores de verificación
  const [showErrorLogs, setShowErrorLogs] = useState(false) // mostrar modal de errores
  const [loadingErrorLogs, setLoadingErrorLogs] = useState(false)
  const [loadingRepairData, setLoadingRepairData] = useState(false) // cargando datos para tab reparar
  const [repairFilter, setRepairFilter] = useState('pending') // 'pending' | 'repaired' | 'discarded'
  const [discardedQuestions, setDiscardedQuestions] = useState({}) // { questionId: true } - falsos positivos descartados

  // Preguntas en histórico (para cada artículo del histórico)
  const [historyQuestions, setHistoryQuestions] = useState({}) // { article_number: questions[] }
  const [loadingHistoryQuestions, setLoadingHistoryQuestions] = useState({}) // { article_number: boolean }
  const [expandedHistoryArticles, setExpandedHistoryArticles] = useState(new Set()) // artículos expandidos
  const [historyAiResults, setHistoryAiResults] = useState({}) // { article_number: { questionId: result } }
  const [verifyingArticle, setVerifyingArticle] = useState(null) // article_number being verified
  const [savedVerifications, setSavedVerifications] = useState({}) // { article_number: results[] }
  const [appliedFixes, setAppliedFixes] = useState({}) // { questionId: true }
  const [applyingFix, setApplyingFix] = useState(null) // questionId being fixed
  const [questionModal, setQuestionModal] = useState(null) // { question, articleNumber, articleContent }
  const [loadingArticleContent, setLoadingArticleContent] = useState(false)
  const [verificationSummaries, setVerificationSummaries] = useState({}) // { article_number: { ok, fixed, problems, total, lastVerifiedAt } }

  // Función para aplicar corrección de IA
  const applyAIFix = async (questionId, newCorrectOption, suggestedFix, verificationId, articleNumber = null) => {
    setApplyingFix(questionId)
    try {
      const response = await fetch('/api/verify-articles/apply-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          newCorrectOption,
          newExplanation: suggestedFix,
          verificationId
        })
      })
      const data = await response.json()
      if (data.success) {
        setAppliedFixes(prev => ({ ...prev, [questionId]: true }))
        // Actualizar el resumen de verificación si tenemos el articleNumber
        if (articleNumber && verificationSummaries[articleNumber]) {
          setVerificationSummaries(prev => {
            const current = prev[articleNumber]
            if (!current) return prev
            return {
              ...prev,
              [articleNumber]: {
                ...current,
                fixed: (current.fixed || 0) + 1,
                problems: Math.max(0, (current.problems || 0) - 1)
              }
            }
          })
        }
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (err) {
      console.error('Error aplicando fix:', err)
      alert('Error al aplicar la corrección')
    } finally {
      setApplyingFix(null)
    }
  }

  // Función para marcar/desmarcar como descartado (falso positivo)
  const toggleDiscarded = async (questionId, articleNumber, shouldDiscard) => {
    try {
      const response = await fetch('/api/verify-articles/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          discarded: shouldDiscard
        })
      })
      const data = await response.json()

      if (data.success) {
        // Actualizar estado local
        if (shouldDiscard) {
          setDiscardedQuestions(prev => ({ ...prev, [questionId]: true }))
        } else {
          setDiscardedQuestions(prev => {
            const next = { ...prev }
            delete next[questionId]
            return next
          })
        }
        // Actualizar también el resultado en historyAiResults para persistencia visual
        setHistoryAiResults(prev => {
          if (prev[articleNumber]?.[questionId]) {
            return {
              ...prev,
              [articleNumber]: {
                ...prev[articleNumber],
                [questionId]: {
                  ...prev[articleNumber][questionId],
                  discarded: shouldDiscard
                }
              }
            }
          }
          return prev
        })
      } else if (data.needsMigration) {
        alert('Error: La columna "discarded" no existe en la base de datos.\n\nEjecuta esta SQL en Supabase:\nALTER TABLE ai_verification_results ADD COLUMN discarded boolean DEFAULT false;')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (err) {
      console.error('Error actualizando estado de descarte:', err)
      alert('Error al actualizar el estado')
    }
  }

  // Cargar logs de errores de verificación
  // Si se pasan articleNumbers, solo carga los de esos artículos
  const loadErrorLogs = async (articleNumbers = null) => {
    setLoadingErrorLogs(true)
    try {
      let url = `/api/verify-articles/errors?lawId=${lawId}&limit=20`
      if (articleNumbers && articleNumbers.length > 0) {
        url += `&articles=${articleNumbers.join(',')}`
      }
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setErrorLogs(data.errors || [])
        setShowErrorLogs(true)
      }
    } catch (err) {
      console.error('Error cargando logs:', err)
    } finally {
      setLoadingErrorLogs(false)
    }
  }

  // Cargar info básica de la ley (sin verificación automática)
  useEffect(() => {
    const loadLaw = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/laws/${lawId}`)
        if (response.ok) {
          const data = await response.json()
          setLaw(data)
        } else {
          const verifyResponse = await fetch(`/api/verify-articles?lawId=${lawId}`)
          const verifyData = await verifyResponse.json()
          if (verifyData.success) {
            setLaw(verifyData.comparison?.law)
          } else {
            setError(verifyData.error || 'Error cargando la ley')
          }
        }
      } catch (err) {
        setError('Error conectando con el servidor')
      } finally {
        setLoading(false)
      }
    }

    if (lawId) {
      loadLaw()
      // Precargar historial y summaries en segundo plano para que el tab cargue más rápido
      loadHistory()
    }
  }, [lawId])

  // Cargar la última verificación guardada
  useEffect(() => {
    const loadSavedVerification = async () => {
      try {
        setLoadingSavedVerification(true)
        console.log('🔍 [VERIFICACIÓN] Cargando verificación guardada para lawId:', lawId)
        const response = await fetch('/api/verify-articles/stats-by-law')
        const data = await response.json()
        console.log('🔍 [VERIFICACIÓN] Respuesta stats-by-law:', data)
        console.log('🔍 [VERIFICACIÓN] Stats para esta ley:', data.stats?.[lawId])
        if (data.success && data.stats[lawId]) {
          console.log('🔍 [VERIFICACIÓN] Guardando en estado:', data.stats[lawId])
          setSavedVerification(data.stats[lawId])
        } else {
          console.log('🔍 [VERIFICACIÓN] No hay datos guardados para esta ley')
        }
      } catch (err) {
        console.error('❌ [VERIFICACIÓN] Error cargando verificación guardada:', err)
      } finally {
        setLoadingSavedVerification(false)
      }
    }

    if (lawId) {
      loadSavedVerification()
    }
  }, [lawId])

  // PASO 0: Ejecutar verificación
  const runVerification = async () => {
    try {
      setVerifying(true)
      setError(null)
      // Limpiar resultados anteriores
      setVerificationResults(null)
      setSelectedArticles(new Set())
      setPostUpdateVerification({})

      // Añadir timestamp para evitar caché
      const timestamp = Date.now()
      const response = await fetch(`/api/verify-articles?lawId=${lawId}&_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await response.json()

      console.log('📊 Verificación BOE:', {
        matching: data.comparison?.summary?.matching,
        title_mismatch: data.comparison?.summary?.title_mismatch,
        content_mismatch: data.comparison?.summary?.content_mismatch,
        details_content_mismatch: data.comparison?.details?.content_mismatch
      })

      if (data.success) {
        setVerificationResults(data)
        setLaw(data.comparison?.law)
        return data // Devolver datos para uso externo
      } else {
        setError(data.error || 'Error verificando artículos')
        return null
      }
    } catch (err) {
      setError('Error conectando con el servidor')
      return null
    } finally {
      setVerifying(false)
    }
  }

  // Ejecutar verificación e ir al paso indicado
  const runVerificationAndGoToStep = async (targetStep = 1) => {
    const result = await runVerification()
    if (result) {
      setCurrentStep(targetStep)
    }
  }

  // Toggle selección de artículo
  const toggleArticleSelection = (articleNumber) => {
    setSelectedArticles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(articleNumber)) {
        newSet.delete(articleNumber)
      } else {
        newSet.add(articleNumber)
      }
      return newSet
    })
  }

  // Seleccionar/deseleccionar todos los artículos actualizables según los filtros actuales
  const selectAllArticles = () => {
    const details = verificationResults?.comparison?.details
    let articlesToSelect = []

    // Función para verificar si un artículo cumple el filtro de similitud
    const matchesSimilarityFilter = (a) => {
      if (similarityRange[0] === 0 && similarityRange[1] === 100) return true
      const sim = a.similarity ?? a.content_similarity ?? (a.type === 'matching' ? 100 : 0)
      return sim >= similarityRange[0] && sim <= similarityRange[1]
    }

    if (filter === 'all' || filter === 'title_mismatch') {
      articlesToSelect.push(...(details?.title_mismatch || [])
        .filter(a => a.db_id && matchesSimilarityFilter(a))
        .map(a => a.article_number))
    }
    if (filter === 'all' || filter === 'content_mismatch') {
      articlesToSelect.push(...(details?.content_mismatch || [])
        .filter(a => a.db_id && matchesSimilarityFilter(a))
        .map(a => a.article_number))
    }
    if (filter === 'matching') {
      articlesToSelect.push(...(details?.matching || [])
        .filter(a => a.db_id && matchesSimilarityFilter(a))
        .map(a => a.article_number))
    }

    setSelectedArticles(new Set(articlesToSelect))
  }

  const deselectAllArticles = () => {
    setSelectedArticles(new Set())
  }

  // PASO 3: Actualizar artículos en BD según BOE
  const updateTitlesInDB = async () => {
    const details = verificationResults?.comparison?.details

    // Incluir title_mismatch, content_mismatch y matching (para refrescar desde BOE)
    const titleMismatches = (details?.title_mismatch || [])
      .filter(a => selectedArticles.has(a.article_number) && a.db_id)
    const contentMismatches = (details?.content_mismatch || [])
      .filter(a => selectedArticles.has(a.article_number) && a.db_id)
    const matchingArticles = (details?.matching || [])
      .filter(a => selectedArticles.has(a.article_number) && a.db_id)
      .map(a => ({ ...a, type: 'matching' }))

    const articlesToUpdate = [...titleMismatches, ...contentMismatches, ...matchingArticles]

    if (articlesToUpdate.length === 0) {
      setError('No hay artículos válidos para actualizar')
      return
    }

    try {
      setUpdating(true)
      setError(null)

      const response = await fetch('/api/verify-articles/update-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lawId,
          articles: articlesToUpdate.map(a => ({
            article_number: a.article_number,
            // Para title_mismatch usamos boe_title/db_title, para content_mismatch y matching usamos title
            boe_title: a.boe_title || a.title,
            db_title: a.db_title || a.title,
            db_id: a.db_id,
            type: a.type || (a.boe_title !== undefined ? 'title_mismatch' : 'content_mismatch')
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        setUpdateResults(data.results)
        setCurrentStep(3) // Ir al paso de resultados de actualización

        // Re-verificar en background para actualizar el summary en BD
        fetch(`/api/verify-articles?lawId=${lawId}&_t=${Date.now()}`, {
          cache: 'no-store'
        }).then(() => {
          // Recargar desde BD
          return fetch('/api/verify-articles/stats-by-law')
        }).then(res => res.json()).then(statsData => {
          if (statsData.success && statsData.stats[lawId]) {
            setSavedVerification(statsData.stats[lawId])
            console.log('✅ Summary recargado desde BD')
          }
        }).catch(err => console.error('Error re-verificando:', err))
      } else {
        setError(data.error || 'Error actualizando títulos')
      }
    } catch (err) {
      setError('Error conectando con el servidor')
    } finally {
      setUpdating(false)
    }
  }

  // Verificar artículos después de actualizar
  const verifyUpdatedArticles = async () => {
    const articleNumbers = updateResults?.updated?.map(u => u.article_number) || []
    if (articleNumbers.length === 0) return

    setVerifyingPostUpdate(true)
    setPostUpdateVerification({})

    for (const articleNumber of articleNumbers) {
      try {
        const response = await fetch(
          `/api/verify-articles/compare?lawId=${lawId}&articleNumber=${articleNumber}`
        )
        const data = await response.json()

        if (data.success) {
          // Calcular similitud de título
          const boeTitle = normalizeForCompare(data.boe?.title || '')
          const dbTitle = normalizeForCompare(data.db?.title || '')
          const titleMatch = boeTitle === dbTitle

          // Calcular similitud de contenido
          const boeContent = normalizeForCompare(data.boe?.content || '')
          const dbContent = normalizeForCompare(data.db?.content || '')
          const contentSimilarity = calculateSimilarity(boeContent, dbContent)

          setPostUpdateVerification(prev => ({
            ...prev,
            [articleNumber]: {
              boe: data.boe,
              db: data.db,
              titleMatch,
              titleSimilarity: titleMatch ? 100 : calculateSimilarity(boeTitle, dbTitle),
              contentSimilarity,
              isFullMatch: titleMatch && contentSimilarity >= 95
            }
          }))
        }
      } catch (err) {
        console.error('Error verificando artículo:', err)
        setPostUpdateVerification(prev => ({
          ...prev,
          [articleNumber]: { error: err.message }
        }))
      }
    }

    setVerifyingPostUpdate(false)
  }

  // Funciones auxiliares para comparación
  const normalizeForCompare = (text) => {
    if (!text) return ''
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,;:()"'\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const calculateSimilarity = (text1, text2) => {
    if (!text1 || !text2) return 0
    if (text1 === text2) return 100

    const words1 = new Set(text1.split(' ').filter(w => w.length > 2))
    const words2 = new Set(text2.split(' ').filter(w => w.length > 2))

    if (words1.size === 0 || words2.size === 0) return 0

    let common = 0
    for (const word of words1) {
      if (words2.has(word)) common++
    }

    return Math.round((common / Math.max(words1.size, words2.size)) * 100)
  }

  // Cargar preguntas de artículos actualizados
  const loadQuestionsForUpdated = async () => {
    setCurrentStep(4)

    // Cargar preguntas de los artículos que fueron actualizados
    const articleNumbers = updateResults?.updated?.map(u => u.article_number) || []

    for (const articleNumber of articleNumbers) {
      if (!articleQuestions[articleNumber]) {
        try {
          setLoadingQuestions(prev => ({ ...prev, [articleNumber]: true }))

          const response = await fetch(
            `/api/verify-articles/questions?lawId=${lawId}&articleNumber=${articleNumber}`
          )
          const data = await response.json()

          if (data.success) {
            setArticleQuestions(prev => ({ ...prev, [articleNumber]: data.questions }))
          }
        } catch (err) {
          console.error('Error cargando preguntas:', err)
        } finally {
          setLoadingQuestions(prev => ({ ...prev, [articleNumber]: false }))
        }
      }
    }
  }

  // Toggle selección de pregunta para IA
  const toggleQuestionSelection = (questionId) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  // Seleccionar todas las preguntas
  const selectAllQuestions = () => {
    const allQuestionIds = []
    const articleNumbers = updateResults?.updated?.map(u => u.article_number) || []
    for (const articleNumber of articleNumbers) {
      const questions = articleQuestions[articleNumber] || []
      questions.forEach(q => allQuestionIds.push(q.id))
    }
    setSelectedQuestions(new Set(allQuestionIds))
  }

  // Verificar preguntas seleccionadas con IA
  const verifySelectedWithAI = async () => {
    if (selectedQuestions.size === 0) return

    setCurrentStep(5)
    setVerifyingWithAI(true)

    // Crear mapa de pregunta -> artículo
    const questionToArticle = {}
    const articleNumbers = updateResults?.updated?.map(u => u.article_number) || []
    for (const articleNumber of articleNumbers) {
      const questions = articleQuestions[articleNumber] || []
      questions.forEach(q => {
        if (selectedQuestions.has(q.id)) {
          questionToArticle[q.id] = { question: q, articleNumber }
        }
      })
    }

    // Verificar cada pregunta secuencialmente
    for (const questionId of selectedQuestions) {
      const entry = questionToArticle[questionId]
      if (!entry) continue

      try {
        const response = await fetch('/api/verify-articles/ai-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lawId,
            articleNumber: entry.articleNumber,
            questionId,
            provider: aiProvider
          })
        })

        const data = await response.json()

        if (data.success) {
          setAiResults(prev => ({ ...prev, [questionId]: data.result }))
        } else {
          setAiResults(prev => ({
            ...prev,
            [questionId]: { error: data.error || 'Error en verificación IA' }
          }))
        }
      } catch (err) {
        setAiResults(prev => ({
          ...prev,
          [questionId]: { error: 'Error conectando con IA' }
        }))
      }
    }

    setVerifyingWithAI(false)
  }

  // Filtrar artículos con discrepancias (o coincidentes)
  const getFilteredDiscrepancies = () => {
    const details = verificationResults?.comparison?.details
    if (!details) return []

    let result = []

    if (filter === 'all' || filter === 'title_mismatch') {
      result = [...result, ...(details.title_mismatch || []).map(a => ({ ...a, type: 'title_mismatch' }))]
    }
    if (filter === 'all' || filter === 'content_mismatch') {
      result = [...result, ...(details.content_mismatch || []).map(a => ({ ...a, type: 'content_mismatch' }))]
    }
    if (filter === 'all' || filter === 'extra_in_db') {
      result = [...result, ...(details.extra_in_db || []).map(a => ({ ...a, type: 'extra_in_db' }))]
    }
    if (filter === 'matching') {
      result = [...result, ...(details.matching || []).map(a => ({ ...a, type: 'matching' }))]
    }

    // Ordenar por número de artículo para facilitar la búsqueda
    result.sort((a, b) => {
      const numA = parseInt(a.article_number) || 0
      const numB = parseInt(b.article_number) || 0
      return numA - numB
    })

    // Filtrar por búsqueda de artículo
    if (searchArticle.trim()) {
      result = result.filter(a => a.article_number.includes(searchArticle.trim()))
    }

    // Filtrar por rango de similitud (solo si no es el rango completo)
    if (similarityRange[0] > 0 || similarityRange[1] < 100) {
      result = result.filter(a => {
        // Obtener similitud del artículo
        const sim = a.similarity ?? a.content_similarity ?? (a.type === 'matching' ? 100 : 0)
        return sim >= similarityRange[0] && sim <= similarityRange[1]
      })
    }

    return result
  }

  // Volver a un paso anterior
  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Cargar resúmenes de verificación para todos los artículos
  const loadVerificationSummaries = async (articleNumbers) => {
    if (!articleNumbers || articleNumbers.length === 0) return {}

    try {
      const response = await fetch(
        `/api/verify-articles/verification-summaries?lawId=${lawId}&articles=${articleNumbers.join(',')}`
      )
      const data = await response.json()
      if (data.success && data.summaries) {
        setVerificationSummaries(data.summaries)
        // También cargar los fixes aplicados
        if (data.appliedFixes) {
          setAppliedFixes(prev => ({ ...prev, ...data.appliedFixes }))
        }
        return data.summaries
      }
      return {}
    } catch (err) {
      console.error('Error cargando resúmenes de verificación:', err)
      return {}
    }
  }

  // Cargar histórico de cambios - devuelve los datos para uso directo
  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/verify-articles/update-titles?lawId=${lawId}`)
      const data = await response.json()
      if (data.success) {
        setHistoryData(data.logs || [])
        // Cargar resúmenes de verificación para todos los artículos del histórico
        const articleNumbers = (data.logs || []).map(log => log.article_number)
        if (articleNumbers.length > 0) {
          const summaries = await loadVerificationSummaries(articleNumbers)
          return { logs: data.logs || [], summaries: summaries || {} }
        }
        return { logs: data.logs || [], summaries: {} }
      }
      return { logs: [], summaries: {} }
    } catch (err) {
      console.error('Error cargando histórico:', err)
      return { logs: [], summaries: {} }
    } finally {
      setLoadingHistory(false)
    }
  }

  // Cambiar a tab de verificar preguntas
  const openHistory = () => {
    setActiveTab('verificar-preguntas')
    if (historyData.length === 0) {
      loadHistory()
    }
  }

  // Función auxiliar para cargar solo los datos (sin toggle)
  const loadArticleQuestionsData = async (articleNumber) => {
    // Si ya tenemos las preguntas, no recargar
    if (historyQuestions[articleNumber]) return

    setLoadingHistoryQuestions(prev => ({ ...prev, [articleNumber]: true }))

    try {
      // Cargar preguntas
      const questionsResponse = await fetch(
        `/api/verify-articles/questions?lawId=${lawId}&articleNumber=${articleNumber}`
      )
      const questionsData = await questionsResponse.json()

      if (questionsData.success) {
        setHistoryQuestions(prev => ({
          ...prev,
          [articleNumber]: questionsData.questions || []
        }))
      }

      // Cargar verificaciones guardadas (si no las tenemos ya en memoria)
      if (!historyAiResults[articleNumber]) {
        const verificationsResponse = await fetch(
          `/api/verify-articles/ai-verify-article?lawId=${lawId}&articleNumber=${articleNumber}`
        )
        const verificationsData = await verificationsResponse.json()

        if (verificationsData.success && verificationsData.results?.length > 0) {
          // Convertir a mapa por questionId
          const resultsMap = {}
          const fixesApplied = {}
          verificationsData.results.forEach(v => {
            resultsMap[v.question_id] = {
              id: v.id,
              isCorrect: v.is_correct,
              confidence: v.confidence,
              explanation: v.explanation,
              articleQuote: v.article_quote,
              suggestedFix: v.suggested_fix,
              correctOptionShouldBe: v.correct_option_should_be,
              newExplanation: v.new_explanation,
              verifiedAt: v.verified_at,
              provider: v.ai_provider,
              fixApplied: v.fix_applied,
              discarded: v.discarded
            }
            if (v.fix_applied) {
              fixesApplied[v.question_id] = true
            }
          })
          setHistoryAiResults(prev => ({
            ...prev,
            [articleNumber]: resultsMap
          }))
          if (Object.keys(fixesApplied).length > 0) {
            setAppliedFixes(prev => ({ ...prev, ...fixesApplied }))
          }
        }
      }
    } catch (err) {
      console.error('Error cargando preguntas:', err)
    } finally {
      setLoadingHistoryQuestions(prev => ({ ...prev, [articleNumber]: false }))
    }
  }

  // Cargar preguntas de un artículo del histórico (con toggle para UI)
  const loadHistoryArticleQuestions = async (articleNumber) => {
    // Toggle expand/collapse
    setExpandedHistoryArticles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(articleNumber)) {
        newSet.delete(articleNumber)
        return newSet
      }
      newSet.add(articleNumber)
      return newSet
    })

    await loadArticleQuestionsData(articleNumber)
  }

  // Función para determinar el estado de verificación de un artículo
  const getArticleVerificationStatus = (articleNumber) => {
    // Primero verificar si tenemos un resumen pre-cargado
    const summary = verificationSummaries[articleNumber]
    if (summary) {
      return {
        status: summary.problems === 0 && summary.verified >= summary.total ? 'all_ok' : 'has_problems',
        total: summary.total,
        verified: summary.verified,
        ok: summary.ok,
        fixed: summary.fixed,
        problems: summary.problems,
        lastVerifiedAt: summary.lastVerifiedAt ? new Date(summary.lastVerifiedAt) : null
      }
    }

    // Si no hay resumen, usar el método detallado (cuando ya se cargaron las preguntas)
    const questions = historyQuestions[articleNumber]
    const aiResults = historyAiResults[articleNumber]

    if (!questions || questions.length === 0) return { status: 'no_questions' }
    if (!aiResults || Object.keys(aiResults).length === 0) return { status: 'not_verified', total: questions.length }

    const verifiedCount = Object.keys(aiResults).length

    // Contar correctas, corregidas y con problemas
    let okCount = 0
    let fixedCount = 0
    let problemCount = 0
    let lastVerifiedAt = null

    questions.forEach(q => {
      const result = aiResults[q.id]
      if (!result) return

      // Obtener la fecha de verificación más reciente
      if (result.verifiedAt) {
        const date = new Date(result.verifiedAt)
        if (!lastVerifiedAt || date > lastVerifiedAt) {
          lastVerifiedAt = date
        }
      }

      if (appliedFixes[q.id]) {
        fixedCount++
      } else if (result.isCorrect === true) {
        okCount++
      } else if (result.isCorrect === false) {
        problemCount++
      }
    })

    return {
      status: problemCount === 0 && verifiedCount >= questions.length ? 'all_ok' : 'has_problems',
      total: questions.length,
      verified: verifiedCount,
      ok: okCount,
      fixed: fixedCount,
      problems: problemCount,
      lastVerifiedAt
    }
  }

  // Verificar TODAS las preguntas de un artículo con IA
  const verifyArticleWithAI = async (articleNumber) => {
    setVerifyingArticle(articleNumber)

    try {
      const response = await fetch('/api/verify-articles/ai-verify-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lawId,
          articleNumber,
          provider: aiProvider,
          model: aiModel
        })
      })

      const data = await response.json()

      if (data.success) {
        // Convertir resultados a mapa por questionId
        const resultsMap = {}
        let okCount = 0
        let problemsCount = 0
        data.results.forEach(r => {
          resultsMap[r.questionId] = {
            isCorrect: r.isCorrect,
            confidence: r.confidence,
            explanation: r.explanation,
            articleQuote: r.articleQuote,
            suggestedFix: r.suggestedFix,
            correctOptionShouldBe: r.correctOptionShouldBe,
            verifiedAt: new Date().toISOString(),
            provider: aiProvider
          }
          if (r.isCorrect === true) okCount++
          else if (r.isCorrect === false) problemsCount++
        })
        setHistoryAiResults(prev => ({
          ...prev,
          [articleNumber]: resultsMap
        }))
        // Actualizar resumen de verificación
        setVerificationSummaries(prev => ({
          ...prev,
          [articleNumber]: {
            total: data.results.length,
            verified: data.results.length,
            ok: okCount,
            fixed: 0,
            problems: problemsCount,
            lastVerifiedAt: new Date().toISOString()
          }
        }))
      } else {
        console.error('Error verificando artículo:', data.error, 'Provider:', aiProvider, 'Model:', aiModel)
        alert(`Error verificando: ${data.error}\n\nModelo: ${aiModel}\nProveedor: ${aiProvider}`)
      }
    } catch (err) {
      console.error('Error conectando con IA:', err)
      alert(`Error de conexión: ${err.message}`)
    } finally {
      setVerifyingArticle(null)
    }
  }

  // Verificar múltiples artículos en lote
  const verifySelectedArticles = async () => {
    const articlesToVerify = Array.from(selectedHistoryArticles)
    if (articlesToVerify.length === 0) return

    setBatchVerifying(true)
    setBatchResults(null)

    // Obtener info detallada de lotes antes de empezar
    let batchInfo = null
    let articleBatchInfo = {} // { articleNumber: { questionCount, batches } }

    try {
      setBatchProgress({
        currentArticle: 0,
        totalArticles: articlesToVerify.length,
        currentArticleNumber: null,
        questionsCompleted: 0,
        questionsTotal: 0,
        currentBatch: 0,
        totalBatches: 0,
        batchSize: 0,
        currentBatchQuestions: 0,
        status: 'Calculando lotes...'
      })

      const infoResponse = await fetch('/api/verify-articles/batch-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lawId,
          articleNumbers: articlesToVerify,
          model: aiModel
        })
      })

      if (infoResponse.ok) {
        batchInfo = await infoResponse.json()
        if (batchInfo.success) {
          // Crear mapa de info por artículo
          batchInfo.articles.forEach(a => {
            articleBatchInfo[a.articleNumber] = a
          })
        }
      }
    } catch (err) {
      console.error('Error obteniendo batch info:', err)
    }

    // Usar info de batch-info si está disponible, sino estimaciones
    const estimatedTotalQuestions = batchInfo?.totals?.questions ||
      articlesToVerify.reduce((acc, articleNumber) => {
        const summary = verificationSummaries[articleNumber]
        return acc + (summary?.total || 0)
      }, 0)

    const estimatedTotalBatches = batchInfo?.totals?.batches || 0
    const batchSize = batchInfo?.batchSize || 4

    setBatchProgress({
      currentArticle: 0,
      totalArticles: articlesToVerify.length,
      currentArticleNumber: null,
      questionsCompleted: 0,
      questionsTotal: estimatedTotalQuestions,
      currentBatch: 0,
      totalBatches: estimatedTotalBatches,
      batchSize,
      currentBatchQuestions: 0,
      status: estimatedTotalBatches > 1
        ? `${estimatedTotalQuestions} preguntas en ${estimatedTotalBatches} lotes`
        : `${estimatedTotalQuestions} preguntas`
    })

    let successCount = 0
    let errorCount = 0
    let totalQuestionsVerified = 0
    let totalQuestionsWithProblems = 0
    let totalQuestionsOk = 0
    const errors = []

    for (let i = 0; i < articlesToVerify.length; i++) {
      const articleNumber = articlesToVerify[i]
      const artInfo = articleBatchInfo[articleNumber] || {}
      const articleQuestions = artInfo.questionCount || verificationSummaries[articleNumber]?.total || 0
      const articleBatches = artInfo.batches || Math.ceil(articleQuestions / batchSize) || 1

      setBatchProgress(prev => ({
        ...prev,
        currentArticle: i + 1,
        currentArticleNumber: articleNumber,
        currentBatch: 0,
        currentBatchQuestions: articleQuestions,
        status: articleBatches > 1
          ? `Art. ${articleNumber}: ${articleQuestions} preguntas (${articleBatches} lotes)`
          : `Art. ${articleNumber}: ${articleQuestions} preguntas`
      }))

      try {
        const response = await fetch('/api/verify-articles/ai-verify-article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lawId,
            articleNumber,
            provider: aiProvider,
            model: aiModel
          })
        })

        if (!response.ok) {
          errorCount++
          errors.push({ article: articleNumber, error: `HTTP ${response.status}` })
          continue
        }

        const data = await response.json()

        if (data?.success && data?.results) {
          successCount++
          const questionsInArticle = data.results.length
          totalQuestionsVerified += questionsInArticle

          // Convertir resultados a mapa por questionId
          const resultsMap = {}
          let okCount = 0
          let problemsCount = 0
          data.results.forEach(r => {
            resultsMap[r.questionId] = {
              isCorrect: r.isCorrect,
              confidence: r.confidence,
              explanation: r.explanation,
              articleQuote: r.articleQuote,
              suggestedFix: r.suggestedFix,
              correctOptionShouldBe: r.correctOptionShouldBe,
              newExplanation: r.newExplanation,
              verifiedAt: new Date().toISOString(),
              provider: aiProvider
            }
            if (r.isCorrect === true) {
              okCount++
              totalQuestionsOk++
            } else if (r.isCorrect === false) {
              problemsCount++
              totalQuestionsWithProblems++
            }
          })

          setHistoryAiResults(prev => ({
            ...prev,
            [articleNumber]: resultsMap
          }))

          // Actualizar resumen de verificación
          setVerificationSummaries(prev => ({
            ...prev,
            [articleNumber]: {
              total: questionsInArticle,
              verified: questionsInArticle,
              ok: okCount,
              fixed: 0,
              problems: problemsCount,
              lastVerifiedAt: new Date().toISOString()
            }
          }))

          // Actualizar progreso con preguntas completadas
          setBatchProgress(prev => ({
            ...prev,
            questionsCompleted: prev.questionsCompleted + questionsInArticle,
            questionsTotal: Math.max(prev.questionsTotal, prev.questionsCompleted + questionsInArticle)
          }))
        } else {
          errorCount++
          const errorMsg = data?.error || 'Respuesta inválida'
          errors.push({ article: articleNumber, error: errorMsg })
          console.error(`Error verificando artículo ${articleNumber}:`, errorMsg)
        }
      } catch (err) {
        errorCount++
        errors.push({ article: articleNumber, error: err.message || 'Error de conexión' })
        console.error(`Error conectando para artículo ${articleNumber}:`, err)
      }

      // Pequeña pausa entre peticiones para no saturar la API
      if (i < articlesToVerify.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setBatchVerifying(false)
    setSelectedHistoryArticles(new Set())

    // Guardar resultados para mostrar en UI
    setBatchResults({
      articlesVerified: successCount,
      articlesWithErrors: errorCount,
      questionsVerified: totalQuestionsVerified,
      questionsOk: totalQuestionsOk,
      questionsWithProblems: totalQuestionsWithProblems,
      errors,
      completedAt: new Date().toISOString()
    })
  }

  // Toggle selección de artículo en histórico
  const toggleHistoryArticleSelection = (articleNumber) => {
    setSelectedHistoryArticles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(articleNumber)) {
        newSet.delete(articleNumber)
      } else {
        newSet.add(articleNumber)
      }
      return newSet
    })
  }

  // Seleccionar/deseleccionar todos los artículos filtrados
  const selectAllFilteredArticles = () => {
    const filteredArticles = historyData.filter(log => {
      const summary = verificationSummaries[log.article_number]
      if (historyFilter === 'all') return true
      if (historyFilter === 'pending') {
        if (!summary) return true
        const verified = (summary.ok || 0) + (summary.fixed || 0) + (summary.problems || 0)
        return verified < (summary.total || 0)
      }
      if (historyFilter === 'problems') return summary && summary.problems > 0
      if (historyFilter === 'ok') {
        if (!summary) return false
        const verified = (summary.ok || 0) + (summary.fixed || 0) + (summary.problems || 0)
        return summary.problems === 0 && verified >= (summary.total || 0) && summary.total > 0
      }
      return true
    }).map(log => log.article_number)

    setSelectedHistoryArticles(new Set(filteredArticles))
  }

  const deselectAllHistoryArticles = () => {
    setSelectedHistoryArticles(new Set())
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando información de la ley...</p>
        </div>
      </div>
    )
  }

  if (error && !law) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Error</h2>
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Link
              href="/admin/monitoreo"
              className="inline-block mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              ← Volver al monitoreo
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const summary = verificationResults?.comparison?.summary
  const filteredDiscrepancies = getFilteredDiscrepancies()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/admin/monitoreo"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-2 inline-block"
          >
            ← Volver al monitoreo
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📋 Verificar Artículos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {law?.short_name} - {law?.name}
          </p>
          {law?.boe_url && (
            <a
              href={law.boe_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400 mt-1 inline-block"
            >
              🔗 Ver en BOE oficial
            </a>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setActiveTab('verificacion')
                setCurrentStep(0)
                // Recargar verificación guardada
                fetch('/api/verify-articles/stats-by-law')
                  .then(res => res.json())
                  .then(data => {
                    if (data.success && data.stats[lawId]) {
                      setSavedVerification(data.stats[lawId])
                    }
                  })
              }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'verificacion'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-b-0 border-gray-200 dark:border-gray-700'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              🔍 Inspeccionar artículos
            </button>
            <button
              onClick={openHistory}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'verificar-preguntas'
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 border border-b-0 border-gray-200 dark:border-gray-700'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              🤖 Verificar preguntas
            </button>
            <button
              onClick={async () => {
                setActiveTab('reparar')
                setLoadingRepairData(true)
                try {
                  // Obtener datos frescos - usar los devueltos directamente para evitar problemas de state async
                  let summariesToUse = verificationSummaries
                  if (historyData.length === 0 || Object.keys(verificationSummaries).length === 0) {
                    const result = await loadHistory()
                    summariesToUse = result.summaries || {}
                  }
                  // Cargar preguntas de artículos con problemas
                  const articlesWithProblems = Object.entries(summariesToUse)
                    .filter(([_, s]) => s.problems > 0)
                    .map(([articleNumber]) => articleNumber)
                  for (const articleNumber of articlesWithProblems) {
                    await loadArticleQuestionsData(articleNumber)
                  }
                } finally {
                  setLoadingRepairData(false)
                }
              }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'reparar'
                  ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 border border-b-0 border-gray-200 dark:border-gray-700'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              🔧 Reparar preguntas
              {/* Badge con conteo de preguntas pendientes (excluyendo reparadas y descartadas) */}
              {(() => {
                let pendingCount = 0
                Object.entries(historyAiResults).forEach(([articleNumber, aiResults]) => {
                  Object.entries(aiResults).forEach(([questionId, result]) => {
                    if (result.isCorrect === false &&
                        !result.fixApplied &&
                        !appliedFixes[questionId] &&
                        !result.discarded &&
                        !discardedQuestions[questionId]) {
                      pendingCount++
                    }
                  })
                })
                if (pendingCount > 0) {
                  return (
                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )
                }
                return null
              })()}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ===================== TAB: VERIFICACIÓN ===================== */}
        {activeTab === 'verificacion' && (
          <>
            {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">❌ {error}</p>
          </div>
        )}

        {/* ===================== PASO 0: Iniciar verificación ===================== */}
        {currentStep === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            {/* DEBUG */}
            {console.log('🎯 [RENDER PASO 0] loadingSavedVerification:', loadingSavedVerification)}
            {console.log('🎯 [RENDER PASO 0] savedVerification:', savedVerification)}
            {console.log('🎯 [RENDER PASO 0] savedVerification?.summary:', savedVerification?.summary)}
            {loadingSavedVerification ? (
              <div className="text-center">
                <Spinner size="md" />
                <p className="text-gray-500 mt-2">Cargando estado...</p>
              </div>
            ) : savedVerification?.summary ? (
              // Mostrar última verificación guardada
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-6xl mb-4">
                    {savedVerification.isOk ? '✅' : '⚠️'}
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {savedVerification.isOk ? 'Artículos sincronizados' : 'Hay discrepancias'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    Última verificación: {new Date(savedVerification.lastVerified).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Resumen expandible */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowSavedSummary(!showSavedSummary)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">
                      📊 Ver resumen de verificación
                    </span>
                    <span className="text-gray-500">
                      {showSavedSummary ? '▲' : '▼'}
                    </span>
                  </button>
                  {showSavedSummary && savedVerification.summary && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-center">
                          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {savedVerification.summary.boe_count || 0}
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">En BOE</div>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-center">
                          <div className="text-xl font-bold text-gray-600 dark:text-gray-300">
                            {savedVerification.summary.db_count || 0}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">En BD</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
                          <div className="text-xl font-bold text-green-600 dark:text-green-400">
                            {savedVerification.summary.ok_count || savedVerification.summary.matching || 0}
                          </div>
                          <div className="text-xs text-green-700 dark:text-green-300">OK</div>
                        </div>
                        {(savedVerification.summary.title_mismatch > 0) && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3 text-center">
                            <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                              {savedVerification.summary.title_mismatch}
                            </div>
                            <div className="text-xs text-yellow-700 dark:text-yellow-300">Título diferente</div>
                          </div>
                        )}
                        {(savedVerification.summary.content_mismatch > 0) && (
                          <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-3 text-center">
                            <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                              {savedVerification.summary.content_mismatch}
                            </div>
                            <div className="text-xs text-orange-700 dark:text-orange-300">Contenido diferente</div>
                          </div>
                        )}
                        {(savedVerification.summary.extra_in_db > 0) && (
                          <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center">
                            <div className="text-xl font-bold text-red-600 dark:text-red-400">
                              {savedVerification.summary.extra_in_db}
                            </div>
                            <div className="text-xs text-red-700 dark:text-red-300">Extra en BD</div>
                          </div>
                        )}
                        {(savedVerification.summary.missing_in_db > 0) && (
                          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3 text-center">
                            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                              {savedVerification.summary.missing_in_db}
                            </div>
                            <div className="text-xs text-purple-700 dark:text-purple-300">Faltan en BD</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => runVerificationAndGoToStep(1)}
                    disabled={verifying}
                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 text-gray-800 dark:text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
                  >
                    {verifying ? (
                      <>
                        <Spinner size="sm" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <>
                        <span>🔄</span>
                        <span>Volver a inspeccionar</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => runVerificationAndGoToStep(2)}
                    disabled={verifying}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
                  >
                    {verifying ? (
                      <>
                        <Spinner size="sm" />
                        <span>Cargando...</span>
                      </>
                    ) : (
                      <>
                        <span>📋</span>
                        <span>Ver artículos</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              // No hay verificación previa - mostrar pantalla inicial
              <div className="text-center">
                <div className="text-6xl mb-4">📊</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Verificación de Artículos
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Este proceso comparará los artículos del BOE oficial con los que tenemos en la base de datos para detectar discrepancias.
                </p>
                <button
                  onClick={() => runVerificationAndGoToStep(1)}
                  disabled={verifying}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
                >
                  {verifying ? (
                    <>
                      <Spinner size="sm" />
                      <span>Verificando BOE...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Iniciar verificación</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================== PASO 1: Resumen de verificación ===================== */}
        {currentStep === 1 && summary && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Resumen de Verificación
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {summary.boe_count}
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">En BOE</div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                    {summary.db_count}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">En BD</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 text-center" title="Título y contenido coinciden">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {summary.matching}
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-300">OK (título + contenido)</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4 text-center" title="Título diferente (contenido puede estar OK o no)">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {summary.title_mismatch}
                  </div>
                  <div className="text-xs text-yellow-700 dark:text-yellow-300">Título diferente</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4 text-center" title="Título OK pero contenido diferente">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {summary.content_mismatch || 0}
                  </div>
                  <div className="text-xs text-orange-700 dark:text-orange-300">Contenido diferente</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {summary.extra_in_db}
                  </div>
                  <div className="text-xs text-red-700 dark:text-red-300">Extra BD</div>
                </div>
              </div>

              <div className="mt-4 text-center">
                {verificationResults?.status === 'ok' ? (
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                    ✅ Todos los artículos coinciden con el BOE
                  </span>
                ) : (
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200">
                    ⚠️ Se encontraron {summary.title_mismatch + (summary.content_mismatch || 0) + summary.extra_in_db} discrepancias
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(0)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ← Volver a verificar
              </button>
              {(summary.title_mismatch > 0 || (summary.content_mismatch || 0) > 0) ? (
                <button
                  onClick={() => setCurrentStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Seleccionar artículos a actualizar →
                </button>
              ) : (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ✓ No hay artículos que actualizar
                </span>
              )}
            </div>
          </div>
        )}

        {/* ===================== PASO 2: Seleccionar artículos para actualizar ===================== */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Filtrar:</span>
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">Todas las discrepancias</option>
                      <option value="title_mismatch">Títulos diferentes</option>
                      <option value="content_mismatch">Solo contenido diferente</option>
                      <option value="extra_in_db">Artículos extra en BD</option>
                      <option value="matching">✅ Coincidentes (OK)</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Similitud:</span>
                    <div className="flex items-center gap-1">
                      {[
                        { label: 'Todos', range: [0, 100] },
                        { label: '80-100%', range: [80, 100] },
                        { label: '60-80%', range: [60, 79] },
                        { label: '40-60%', range: [40, 59] },
                        { label: '20-40%', range: [20, 39] },
                        { label: '0-20%', range: [0, 19] },
                      ].map(({ label, range }) => (
                        <button
                          key={label}
                          onClick={() => setSimilarityRange(range)}
                          className={`px-2 py-1 text-xs rounded ${
                            similarityRange[0] === range[0] && similarityRange[1] === range[1]
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Buscar:</span>
                    <input
                      type="text"
                      value={searchArticle}
                      onChange={(e) => setSearchArticle(e.target.value)}
                      placeholder="Nº art..."
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-24"
                    />
                    {searchArticle && (
                      <button
                        onClick={() => setSearchArticle('')}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        title="Limpiar búsqueda"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={selectAllArticles}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Seleccionar actualizables
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button
                    onClick={deselectAllArticles}
                    className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400"
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Selecciona artículos para actualizar ({selectedArticles.size} seleccionados)
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Selecciona artículos para actualizar desde el BOE. Usa el filtro para ver también los coincidentes.
                </p>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
                {filteredDiscrepancies.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    {searchArticle
                      ? `No se encontró el artículo "${searchArticle}" en las discrepancias`
                      : 'No hay discrepancias con el filtro seleccionado'}
                  </div>
                ) : (
                  filteredDiscrepancies.map((art) => {
                    const canUpdate = (art.type === 'title_mismatch' || art.type === 'content_mismatch' || art.type === 'matching') && art.db_id
                    const isMatching = art.type === 'matching'
                    return (
                      <label
                        key={`${art.type}-${art.article_number}`}
                        className={`flex items-start p-4 ${canUpdate ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer' : 'opacity-60'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedArticles.has(art.article_number)}
                          onChange={() => canUpdate && toggleArticleSelection(art.article_number)}
                          disabled={!canUpdate}
                          className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              Artículo {art.article_number}
                            </span>
                            {/* Badge del tipo */}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              art.type === 'matching'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                : art.type === 'title_mismatch'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                  : art.type === 'content_mismatch'
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                            }`}>
                              {art.type === 'matching' ? '✓ Coincide' : art.type === 'title_mismatch' ? 'Título diferente' : art.type === 'content_mismatch' ? 'Contenido diferente' : 'Extra en BD'}
                            </span>
                            {/* Estado del contenido - siempre mostrar para title_mismatch */}
                            {art.type === 'title_mismatch' && (
                              art.content_ok ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                                  ✓ Contenido idéntico
                                </span>
                              ) : (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  (art.content_similarity || 0) >= 90
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                    : (art.content_similarity || 0) >= 70
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                      : (art.content_similarity || 0) >= 40
                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                }`}>
                                  Contenido {art.content_similarity || 0}% similar
                                </span>
                              )
                            )}
                            {/* Similitud para content_mismatch */}
                            {art.type === 'content_mismatch' && art.similarity !== undefined && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                art.similarity >= 90
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                  : art.similarity >= 70
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                    : art.similarity >= 40
                                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                              }`}>
                                Contenido {art.similarity}% similar
                              </span>
                            )}
                            {/* Badge si BOE no tiene título */}
                            {art.boe_has_no_title && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                BOE sin título
                              </span>
                            )}
                            {!canUpdate && (art.type === 'title_mismatch' || art.type === 'content_mismatch') && (
                              <span className="text-xs text-red-500">(sin ID en BD)</span>
                            )}
                          </div>
                          {/* Detalles para title_mismatch */}
                          {art.type === 'title_mismatch' && (
                            <div className="mt-2 text-sm space-y-1">
                              <div>
                                <span className="text-green-600 dark:text-green-400 font-medium">BOE: </span>
                                <span className="text-gray-600 dark:text-gray-400">{art.boe_title || '(sin título)'}</span>
                              </div>
                              <div>
                                <span className="text-red-600 dark:text-red-400 font-medium">BD: </span>
                                <span className="text-gray-600 dark:text-gray-400">{art.db_title || '(sin título)'}</span>
                              </div>
                              {art.boe_content_preview && (
                                <div className="mt-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                  <span className="font-medium">Contenido BOE: </span>{art.boe_content_preview}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Detalles para content_mismatch */}
                          {art.type === 'content_mismatch' && (
                            <div className="mt-2 text-sm space-y-1">
                              <div className="text-gray-700 dark:text-gray-300 font-medium">{art.title}</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                                <div className="text-xs text-gray-500 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                  <span className="font-medium text-green-700 dark:text-green-400">BOE: </span>
                                  {art.boe_content_preview}
                                </div>
                                <div className="text-xs text-gray-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                  <span className="font-medium text-red-700 dark:text-red-400">BD: </span>
                                  {art.db_content_preview}
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Detalles para extra_in_db */}
                          {art.type === 'extra_in_db' && (
                            <div className="mt-1 text-sm text-gray-500">
                              Este artículo no está en el BOE (puede estar derogado)
                            </div>
                          )}
                          {/* Botón para ver comparación completa */}
                          {(art.type === 'title_mismatch' || art.type === 'content_mismatch') && (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setCompareArticle(art)
                              }}
                              className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                            >
                              🔍 Ver comparación completa
                            </button>
                          )}
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={goBack}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ← Volver al resumen
              </button>
              <button
                onClick={updateTitlesInDB}
                disabled={selectedArticles.size === 0 || updating}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {updating ? (
                  <>
                    <Spinner size="sm" />
                    <span>Actualizando...</span>
                  </>
                ) : (
                  <>
                    <span>✏️</span>
                    <span>Actualizar {selectedArticles.size} artículos en BD →</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ===================== PASO 3: Resultado de actualización ===================== */}
        {currentStep === 3 && updateResults && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-green-200 dark:border-green-800 p-6">
              <h2 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-4">
                ✅ Actualización completada
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {updateResults.updated?.length || 0}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">Actualizados</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {updateResults.errors?.length || 0}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">Errores</div>
                </div>
              </div>

              {/* Detalle de actualizaciones */}
              {updateResults.updated?.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      📝 Registro de cambios:
                    </h3>
                    <button
                      onClick={verifyUpdatedArticles}
                      disabled={verifyingPostUpdate}
                      className="text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      {verifyingPostUpdate ? (
                        <>
                          <Spinner size="sm" />
                          <span>Verificando...</span>
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          <span>Verificar coincidencia</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {updateResults.updated.map((item, i) => {
                      const verification = postUpdateVerification[item.article_number]
                      return (
                        <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-900 dark:text-white">
                              Artículo {item.article_number}
                            </div>
                            <div className="flex items-center gap-2">
                              {item.content_updated && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">
                                  + contenido
                                </span>
                              )}
                              {verification?.isFullMatch && (
                                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full">
                                  ✓ 100% idéntico
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Cambio de título */}
                          <div className="text-sm mb-2">
                            <span className="text-red-600 dark:text-red-400 line-through">{item.old_title}</span>
                            <span className="text-gray-500 mx-2">→</span>
                            <span className="text-green-600 dark:text-green-400">{item.new_title}</span>
                          </div>

                          {/* Resultados de verificación */}
                          {verification && !verification.error && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <div className="flex flex-wrap gap-3 mb-3">
                                <div className={`text-xs px-3 py-1 rounded-full ${
                                  verification.titleSimilarity === 100
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                }`}>
                                  Título: {verification.titleSimilarity}% similar
                                </div>
                                <div className={`text-xs px-3 py-1 rounded-full ${
                                  verification.contentSimilarity >= 95
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                    : verification.contentSimilarity >= 70
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                }`}>
                                  Contenido: {verification.contentSimilarity}% similar
                                </div>
                              </div>

                              {/* Comparación lado a lado */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                                  <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">BOE Oficial</div>
                                  <div className="text-xs text-green-800 dark:text-green-200 font-medium mb-1">
                                    {verification.boe?.title || '(sin título)'}
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                    {verification.boe?.content?.substring(0, 500) || 'Sin contenido'}
                                    {verification.boe?.content?.length > 500 && '...'}
                                  </div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Base de Datos</div>
                                  <div className="text-xs text-blue-800 dark:text-blue-200 font-medium mb-1">
                                    {verification.db?.title || '(sin título)'}
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                    {verification.db?.content?.substring(0, 500) || 'Sin contenido'}
                                    {verification.db?.content?.length > 500 && '...'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {verification?.error && (
                            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                              Error verificando: {verification.error}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {updateResults.errors?.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <h3 className="font-medium text-red-700 dark:text-red-300 mb-2">Errores:</h3>
                  {updateResults.errors.map((err, i) => (
                    <div key={i} className="text-sm text-red-600 dark:text-red-400">
                      Artículo {err.article_number}: {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-start">
              <button
                onClick={() => setCurrentStep(0)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ← Empezar de nuevo
              </button>
            </div>
          </div>
        )}

        {/* ===================== PASO 4: Ver preguntas de artículos actualizados ===================== */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4 mb-4">
              <p className="text-blue-700 dark:text-blue-300">
                Selecciona las preguntas que quieres verificar con IA para comprobar si siguen siendo correctas
                después de actualizar los títulos de los artículos.
              </p>
            </div>

            {/* Lista de artículos actualizados con sus preguntas */}
            {(updateResults?.updated || []).map(updated => {
              const questions = articleQuestions[updated.article_number] || []
              const isLoading = loadingQuestions[updated.article_number]

              return (
                <div
                  key={updated.article_number}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                >
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Artículo {updated.article_number}
                        </h3>
                        <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                          ✓ Título actualizado: {updated.new_title}
                        </div>
                      </div>
                      <a
                        href={`${law?.boe_url}#a${updated.article_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        🔗 Ver en BOE
                      </a>
                    </div>
                  </div>

                  <div className="p-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8 text-gray-500">
                        <Spinner size="md" />
                        <span className="ml-2">Cargando preguntas...</span>
                      </div>
                    ) : questions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No hay preguntas vinculadas a este artículo
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {questions.map(question => (
                          <label
                            key={question.id}
                            className="flex items-start p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedQuestions.has(question.id)}
                              onChange={() => toggleQuestionSelection(question.id)}
                              className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-gray-800 dark:text-gray-200">
                                  {question.question_text}
                                </p>
                                <a
                                  href={`/pregunta/${question.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded transition-colors flex-shrink-0"
                                  title="Ver pregunta completa con artículo"
                                >
                                  👁️ Ver
                                </a>
                              </div>
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 grid grid-cols-2 gap-1">
                                <div className={question.correct_option === 0 ? 'font-bold text-green-600' : ''}>
                                  A) {question.option_a}
                                </div>
                                <div className={question.correct_option === 1 ? 'font-bold text-green-600' : ''}>
                                  B) {question.option_b}
                                </div>
                                <div className={question.correct_option === 2 ? 'font-bold text-green-600' : ''}>
                                  C) {question.option_c}
                                </div>
                                <div className={question.correct_option === 3 ? 'font-bold text-green-600' : ''}>
                                  D) {question.option_d}
                                </div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="text-center">
              <button
                onClick={selectAllQuestions}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Seleccionar todas las preguntas
              </button>
            </div>

            <div className="flex justify-between">
              <button
                onClick={goBack}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ← Volver a actualización
              </button>
              <div className="flex items-center space-x-4">
                <div className="flex items-center gap-2">
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                  </select>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    {getAllProviderModels(aiProvider).map(model => (
                      <option
                        key={model.id}
                        value={model.id}
                        disabled={model.status === 'failed'}
                        className={model.status === 'failed' ? 'text-red-500' : ''}
                      >
                        {model.status === 'working' ? '✓ ' : model.status === 'failed' ? '✗ ' : ''}
                        {model.name}
                        {model.status === 'failed' ? ' (falla)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={verifySelectedWithAI}
                  disabled={selectedQuestions.size === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <span>🤖</span>
                  <span>Verificar con IA ({selectedQuestions.size}) →</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== PASO 5: Resultados de verificación IA ===================== */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  🤖 Resultados de verificación IA
                </h2>
                {verifyingWithAI && (
                  <div className="flex items-center text-blue-600 dark:text-blue-400">
                    <Spinner size="sm" />
                    <span className="ml-2 text-sm">Verificando...</span>
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Verificando {selectedQuestions.size} preguntas con {getProviderModels(aiProvider).find(m => m.id === aiModel)?.name || aiModel}
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                {Array.from(selectedQuestions).map(questionId => {
                  const result = aiResults[questionId]
                  let question = null
                  const articleNumbers = updateResults?.updated?.map(u => u.article_number) || []
                  for (const articleNumber of articleNumbers) {
                    const questions = articleQuestions[articleNumber] || []
                    question = questions.find(q => q.id === questionId)
                    if (question) break
                  }

                  return (
                    <div key={questionId} className="py-4">
                      <p className="text-sm text-gray-800 dark:text-gray-200 mb-2 font-medium">
                        {question?.question_text || `Pregunta ${questionId}`}
                      </p>

                      {!result ? (
                        <div className="flex items-center text-gray-500 text-sm">
                          <Spinner size="sm" />
                          <span className="ml-2">Verificando...</span>
                        </div>
                      ) : result.error ? (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                          ❌ {result.error}
                        </div>
                      ) : appliedFixes[result.questionId] ? (
                        // Mostrar estado corregido
                        <div className="p-3 rounded-lg text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                          <div className="font-medium mb-1">
                            ✅ Pregunta corregida
                          </div>
                          <p>La respuesta correcta se cambió a: <strong>{result.correctOptionShouldBe}</strong></p>
                          {result.newExplanation && (
                            <div className="mt-2 p-2 bg-green-100/50 dark:bg-green-800/20 rounded text-xs">
                              <span className="font-medium">Nueva explicación aplicada</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`p-3 rounded-lg text-sm ${
                          result.isCorrect
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        }`}>
                          <div className="font-medium mb-1">
                            {result.isCorrect ? '✅ Pregunta correcta' : '❌ Posible problema detectado'}
                            {result.confidence && (
                              <span className="ml-2 text-xs opacity-75">
                                (Confianza: {result.confidence})
                              </span>
                            )}
                          </div>
                          <p>{result.explanation}</p>
                          {result.articleQuote && (
                            <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded text-xs">
                              <span className="font-medium">Cita del BOE:</span> "{result.articleQuote}"
                            </div>
                          )}
                          {result.suggestedFix && (
                            <div className="mt-2 p-2 bg-yellow-100/50 dark:bg-yellow-900/20 rounded">
                              <span className="font-medium">Sugerencia:</span> {result.suggestedFix}
                            </div>
                          )}
                          {result.correctOptionShouldBe && (
                            <div className="mt-2 p-2 bg-orange-100/50 dark:bg-orange-900/20 rounded">
                              <div className="font-medium mb-2">
                                La respuesta correcta debería ser: {result.correctOptionShouldBe}
                              </div>
                              {result.newExplanation && (
                                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                                  <span className="font-medium text-blue-700 dark:text-blue-300">Nueva explicación:</span>
                                  <p className="mt-1 text-blue-600 dark:text-blue-400">{result.newExplanation}</p>
                                </div>
                              )}
                              <button
                                onClick={() => applyAIFix(
                                  result.questionId,
                                  result.correctOptionShouldBe,
                                  result.newExplanation || result.suggestedFix,
                                  result.verificationId,
                                  question?.article_number
                                )}
                                disabled={applyingFix === result.questionId}
                                className="mt-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
                              >
                                {applyingFix === result.questionId ? (
                                  <>
                                    <Spinner size="sm" />
                                    <span>Aplicando...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>🔧</span>
                                    <span>Aplicar corrección</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Resumen de resultados */}
            {!verifyingWithAI && Object.keys(aiResults).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Resumen</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {Object.values(aiResults).filter(r => r.isCorrect === true).length}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">Correctas</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {Object.values(aiResults).filter(r => r.isCorrect === false).length}
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">Con problemas</div>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                      {Object.values(aiResults).filter(r => r.error).length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Errores</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={goBack}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ← Volver a preguntas
              </button>
              <button
                onClick={() => {
                  setCurrentStep(0)
                  setVerificationResults(null)
                  setUpdateResults(null)
                  setSelectedArticles(new Set())
                  setSelectedQuestions(new Set())
                  setAiResults({})
                  setArticleQuestions({})
                }}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                🔄 Nueva verificación
              </button>
            </div>
          </div>
        )}
          </>
        )}

        {/* ===================== TAB: VERIFICAR PREGUNTAS ===================== */}
        {activeTab === 'verificar-preguntas' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Verificar preguntas con IA
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Selecciona artículos para verificar sus preguntas con inteligencia artificial
                  </p>
                </div>
                <button
                  onClick={loadHistory}
                  disabled={loadingHistory}
                  className="text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  {loadingHistory ? <Spinner size="sm" /> : '🔄'}
                  <span>Actualizar</span>
                </button>
              </div>

              {/* Filtros de estado de verificación */}
              {historyData.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  {[
                    { id: 'all', label: 'Todos', icon: '📋' },
                    { id: 'pending', label: 'Pendientes', icon: '⏳' },
                    { id: 'problems', label: 'Con problemas', icon: '⚠️' },
                    { id: 'ok', label: 'Verificados OK', icon: '✅' },
                  ].map(f => {
                    // Contar artículos por filtro
                    const count = historyData.filter(log => {
                      const summary = verificationSummaries[log.article_number]
                      if (f.id === 'all') return true
                      if (f.id === 'pending') {
                        // Sin verificar: no hay summary o verified < total
                        if (!summary) return true
                        const verified = (summary.ok || 0) + (summary.fixed || 0) + (summary.problems || 0)
                        return verified < (summary.total || 0)
                      }
                      if (f.id === 'problems') {
                        return summary && summary.problems > 0
                      }
                      if (f.id === 'ok') {
                        if (!summary) return false
                        const verified = (summary.ok || 0) + (summary.fixed || 0) + (summary.problems || 0)
                        return summary.problems === 0 && verified >= (summary.total || 0) && summary.total > 0
                      }
                      return true
                    }).length

                    return (
                      <button
                        key={f.id}
                        onClick={() => setHistoryFilter(f.id)}
                        className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                          historyFilter === f.id
                            ? f.id === 'pending' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                            : f.id === 'problems' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                            : f.id === 'ok' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span>{f.icon}</span>
                        <span>{f.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          historyFilter === f.id
                            ? 'bg-white/50 dark:bg-black/20'
                            : 'bg-gray-200 dark:bg-gray-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Controles de selección y verificación en lote */}
              {historyData.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllFilteredArticles}
                      disabled={batchVerifying}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
                    >
                      Seleccionar todos
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <button
                      onClick={deselectAllHistoryArticles}
                      disabled={batchVerifying}
                      className="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 disabled:opacity-50"
                    >
                      Deseleccionar
                    </button>
                  </div>

                  {selectedHistoryArticles.size > 0 && (
                    <div className="flex items-center gap-3 ml-auto">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedHistoryArticles.size} seleccionado{selectedHistoryArticles.size !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={verifySelectedArticles}
                        disabled={batchVerifying}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        {batchVerifying ? (
                          <>
                            <Spinner size="sm" />
                            <span>Verificando...</span>
                          </>
                        ) : (
                          <>
                            <span>🤖</span>
                            <span>Verificar seleccionados</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Barra de progreso durante verificación en lote */}
                  {batchVerifying && (
                    <div className="w-full mt-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                      {/* Info del artículo actual */}
                      <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-2">
                          <Spinner size="sm" />
                          <span className="font-medium text-purple-700 dark:text-purple-300">
                            {batchProgress.currentArticleNumber
                              ? `Verificando artículo ${batchProgress.currentArticleNumber}`
                              : 'Preparando verificación...'}
                          </span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">
                          Artículo {batchProgress.currentArticle} de {batchProgress.totalArticles}
                        </span>
                      </div>

                      {/* Mensaje de estado (info de lotes) */}
                      {batchProgress.status && (
                        <div className="mb-3 px-3 py-1.5 bg-purple-100 dark:bg-purple-800/30 rounded text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{batchProgress.status}</span>
                        </div>
                      )}

                      {/* Barra de progreso por PREGUNTAS */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                          <span className="font-medium">Preguntas verificadas</span>
                          <span>
                            {batchProgress.questionsCompleted}
                            {batchProgress.questionsTotal > 0 ? ` / ${batchProgress.questionsTotal}` : ''}
                          </span>
                        </div>
                        <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500 relative overflow-hidden"
                            style={{
                              width: batchProgress.questionsTotal > 0
                                ? `${Math.min((batchProgress.questionsCompleted / batchProgress.questionsTotal) * 100, 100)}%`
                                : '5%'
                            }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Panel de resultados después de verificación en lote */}
                  {batchResults && !batchVerifying && (
                    <div className={`w-full mt-2 rounded-lg p-4 border ${
                      batchResults.articlesWithErrors > 0
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                        : batchResults.questionsWithProblems > 0
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                            {batchResults.articlesWithErrors > 0 ? '⚠️' : batchResults.questionsWithProblems > 0 ? '📋' : '✅'}
                            Verificación completada
                          </h4>

                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 dark:text-gray-400">Artículos:</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {batchResults.articlesVerified} verificados
                                {batchResults.articlesWithErrors > 0 && (
                                  <span className="text-red-600 dark:text-red-400 ml-1">
                                    ({batchResults.articlesWithErrors} errores)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 dark:text-gray-400">Preguntas:</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {batchResults.questionsVerified} verificadas
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 dark:text-gray-400">Correctas:</span>
                              <span className="font-medium text-green-600 dark:text-green-400">
                                {batchResults.questionsOk}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 dark:text-gray-400">Con problemas:</span>
                              <span className={`font-medium ${
                                batchResults.questionsWithProblems > 0
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {batchResults.questionsWithProblems}
                              </span>
                            </div>
                          </div>

                          {/* Errores detallados */}
                          {batchResults.errors?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-700">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Errores:</p>
                                <button
                                  onClick={() => {
                                    // Pasar solo los artículos que fallaron
                                    const failedArticles = batchResults.errors?.map(e => e.article) || []
                                    loadErrorLogs(failedArticles)
                                  }}
                                  disabled={loadingErrorLogs}
                                  className="text-xs text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200 underline flex items-center gap-1"
                                >
                                  {loadingErrorLogs ? (
                                    <>
                                      <Spinner size="sm" />
                                      <span>Cargando...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>🔍</span>
                                      <span>Ver detalles guardados</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <ul className="text-xs text-orange-600 dark:text-orange-400 space-y-0.5">
                                {batchResults.errors.slice(0, 3).map((e, i) => (
                                  <li key={i}>• Art. {e.article}: {e.error}</li>
                                ))}
                                {batchResults.errors.length > 3 && (
                                  <li className="text-gray-500">...y {batchResults.errors.length - 3} más</li>
                                )}
                              </ul>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                                Las preguntas de estos artículos no se han verificado. Puedes volver a intentarlo seleccionándolos de nuevo.
                              </p>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setBatchResults(null)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                          title="Cerrar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                  <span className="ml-3 text-gray-500">Cargando histórico...</span>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <div className="text-5xl mb-4">📭</div>
                  <p className="text-lg font-medium">No hay cambios registrados</p>
                  <p className="text-sm mt-1">Los cambios aparecerán aquí cuando actualices artículos desde el BOE</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyData
                    .filter(log => {
                      const summary = verificationSummaries[log.article_number]
                      if (historyFilter === 'all') return true
                      if (historyFilter === 'pending') {
                        if (!summary) return true
                        const verified = (summary.ok || 0) + (summary.fixed || 0) + (summary.problems || 0)
                        return verified < (summary.total || 0)
                      }
                      if (historyFilter === 'problems') {
                        return summary && summary.problems > 0
                      }
                      if (historyFilter === 'ok') {
                        if (!summary) return false
                        const verified = (summary.ok || 0) + (summary.fixed || 0) + (summary.problems || 0)
                        return summary.problems === 0 && verified >= (summary.total || 0) && summary.total > 0
                      }
                      return true
                    })
                    .map((log, i) => (
                    <div
                      key={log.id || i}
                      className={`bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border transition-colors ${
                        selectedHistoryArticles.has(log.article_number)
                          ? 'border-purple-400 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-100 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {/* Checkbox de selección */}
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedHistoryArticles.has(log.article_number)}
                              onChange={() => toggleHistoryArticleSelection(log.article_number)}
                              disabled={batchVerifying}
                              className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                            />
                          </label>
                          <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                            Art. {log.article_number}
                          </span>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            log.change_type === 'full_update'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                          }`}>
                            {log.change_type === 'full_update' ? '📝 Título + Contenido' : '📌 Solo título'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(log.created_at).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-12 flex-shrink-0 mt-0.5">Antes:</span>
                          <span className="text-sm text-red-600 dark:text-red-400 line-through">
                            {log.old_title || '(sin título)'}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-12 flex-shrink-0 mt-0.5">Ahora:</span>
                          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                            {log.new_title || '(sin título)'}
                          </span>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex flex-wrap gap-3">
                        <button
                          onClick={() => {
                            setCompareArticle({
                              article_number: log.article_number,
                              db_id: log.article_id
                            })
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                        >
                          🔍 Ver BOE vs BD
                        </button>
                        {(() => {
                          const status = getArticleVerificationStatus(log.article_number)
                          const isExpanded = expandedHistoryArticles.has(log.article_number)

                          // Si todas OK, mostrar check verde con fecha y botón volver a revisar
                          if (status.status === 'all_ok') {
                            return (
                              <>
                                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                  <span>✅</span>
                                  <span>{status.ok} OK{status.fixed > 0 ? ` + ${status.fixed} corregidas` : ''}</span>
                                  {status.lastVerifiedAt && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                      ({status.lastVerifiedAt.toLocaleDateString('es-ES')})
                                    </span>
                                  )}
                                </span>
                                <button
                                  onClick={() => loadHistoryArticleQuestions(log.article_number)}
                                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                >
                                  {isExpanded ? '🔄 Ocultar' : '🔄 Volver a revisar'}
                                </button>
                              </>
                            )
                          }

                          // Si hay problemas o preguntas sin verificar
                          if (status.status === 'has_problems') {
                            const sinVerificar = (status.total || 0) - (status.verified || 0)
                            const tieneProblemasReales = status.problems > 0
                            const nadaVerificado = (status.verified || 0) === 0 && (status.total || 0) > 0

                            return (
                              <button
                                onClick={() => loadHistoryArticleQuestions(log.article_number)}
                                className={`text-sm flex items-center gap-1 ${
                                  tieneProblemasReales
                                    ? 'text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300'
                                    : 'text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300'
                                }`}
                              >
                                <span>{tieneProblemasReales ? '⚠️' : '🔍'}</span>
                                <span>
                                  {nadaVerificado
                                    ? `${status.total} preguntas sin verificar`
                                    : tieneProblemasReales
                                      ? `${status.ok} OK${status.fixed > 0 ? ` + ${status.fixed} corr.` : ''} / ${status.problems} con problemas${sinVerificar > 0 ? ` / ${sinVerificar} sin verificar` : ''}`
                                      : `${status.ok} OK${status.fixed > 0 ? ` + ${status.fixed} corr.` : ''}${sinVerificar > 0 ? ` / ${sinVerificar} sin verificar` : ''}`
                                  }
                                </span>
                                {isExpanded && <span className="text-xs">(ocultar)</span>}
                              </button>
                            )
                          }

                          // No verificado aún
                          return (
                            <button
                              onClick={() => loadHistoryArticleQuestions(log.article_number)}
                              className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 flex items-center gap-1"
                            >
                              {isExpanded ? '📖 Ocultar preguntas' : '📖 Ver preguntas vinculadas'}
                            </button>
                          )
                        })()}
                      </div>

                      {/* Sección expandible de preguntas */}
                      {expandedHistoryArticles.has(log.article_number) && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          {loadingHistoryQuestions[log.article_number] ? (
                            <div className="flex items-center justify-center py-4 text-gray-500">
                              <Spinner size="sm" />
                              <span className="ml-2">Cargando preguntas...</span>
                            </div>
                          ) : (historyQuestions[log.article_number]?.length || 0) === 0 ? (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                              No hay preguntas vinculadas a este artículo
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Header con contador y botón verificar todas */}
                              <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                                <div>
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {historyQuestions[log.article_number]?.length} preguntas encontradas
                                  </span>
                                  {historyAiResults[log.article_number] && Object.keys(historyAiResults[log.article_number]).length > 0 && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      {Object.values(historyAiResults[log.article_number]).filter(r => r.isCorrect === true).length} correctas,{' '}
                                      {Object.values(historyAiResults[log.article_number]).filter(r => r.isCorrect === false).length} con problemas
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={aiProvider}
                                    onChange={(e) => setAiProvider(e.target.value)}
                                    className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  >
                                    <option value="openai">OpenAI</option>
                                    <option value="anthropic">Anthropic</option>
                                    <option value="google">Google</option>
                                  </select>
                                  <select
                                    value={aiModel}
                                    onChange={(e) => setAiModel(e.target.value)}
                                    className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  >
                                    {getAllProviderModels(aiProvider).map(model => (
                                      <option
                                        key={model.id}
                                        value={model.id}
                                        disabled={model.status === 'failed'}
                                      >
                                        {model.status === 'working' ? '✓ ' : model.status === 'failed' ? '✗ ' : ''}
                                        {model.name}
                                        {model.status === 'failed' ? ' (falla)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => verifyArticleWithAI(log.article_number)}
                                    disabled={verifyingArticle === log.article_number}
                                    className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                  >
                                    {verifyingArticle === log.article_number ? (
                                      <>
                                        <Spinner size="sm" />
                                        <span>Verificando todas...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>🤖</span>
                                        <span>Verificar todas con IA</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Lista de preguntas */}
                              {historyQuestions[log.article_number]?.map((question) => {
                                const aiResult = historyAiResults[log.article_number]?.[question.id]

                                return (
                                  <div
                                    key={question.id}
                                    className={`bg-white dark:bg-gray-800 rounded-lg p-3 border ${
                                      appliedFixes[question.id]
                                        ? 'border-green-300 dark:border-green-700'
                                        : aiResult
                                          ? aiResult.isCorrect
                                            ? 'border-green-300 dark:border-green-700'
                                            : 'border-red-300 dark:border-red-700'
                                          : 'border-gray-200 dark:border-gray-600'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <p className="text-sm text-gray-800 dark:text-gray-200">
                                        {question.question_text}
                                      </p>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <a
                                          href={`/pregunta/${question.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded transition-colors"
                                          title="Ver pregunta completa con artículo"
                                        >
                                          👁️ Ver
                                        </a>
                                        {aiResult && (
                                          <span className="text-lg">
                                            {aiResult.isCorrect ? '✅' : '❌'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                                      <div className={question.correct_option === 0 ? 'font-bold text-green-600' : ''}>
                                        A) {question.option_a}
                                      </div>
                                      <div className={question.correct_option === 1 ? 'font-bold text-green-600' : ''}>
                                        B) {question.option_b}
                                      </div>
                                      <div className={question.correct_option === 2 ? 'font-bold text-green-600' : ''}>
                                        C) {question.option_c}
                                      </div>
                                      <div className={question.correct_option === 3 ? 'font-bold text-green-600' : ''}>
                                        D) {question.option_d}
                                      </div>
                                    </div>

                                    {/* Resultado de IA */}
                                    {aiResult && (
                                      <div className={`p-2 rounded-lg text-xs ${
                                        aiResult.error
                                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                          : appliedFixes[question.id]
                                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                            : aiResult.isCorrect
                                              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                      }`}>
                                        {aiResult.error ? (
                                          <span>❌ {aiResult.error}</span>
                                        ) : appliedFixes[question.id] ? (
                                          // Estado corregido
                                          <>
                                            <div className="font-medium mb-1">✅ Pregunta corregida</div>
                                            <p>Respuesta cambiada a: <strong>{aiResult.correctOptionShouldBe}</strong></p>
                                            {aiResult.newExplanation && (
                                              <div className="mt-1 text-[10px] opacity-75">Nueva explicación aplicada</div>
                                            )}
                                          </>
                                        ) : (
                                          <>
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="font-medium">
                                                {aiResult.isCorrect ? 'Pregunta correcta' : 'Posible problema'}
                                                {aiResult.confidence && (
                                                  <span className="ml-1 opacity-75">({aiResult.confidence})</span>
                                                )}
                                              </span>
                                              {aiResult.verifiedAt && (
                                                <span className="text-[10px] opacity-60">
                                                  {new Date(aiResult.verifiedAt).toLocaleDateString('es-ES')}
                                                </span>
                                              )}
                                            </div>
                                            <p>{aiResult.explanation}</p>
                                            {aiResult.articleQuote && (
                                              <div className="mt-1 p-1 bg-white/50 dark:bg-black/20 rounded text-[10px] italic">
                                                "{aiResult.articleQuote}"
                                              </div>
                                            )}
                                            {aiResult.suggestedFix && (
                                              <div className="mt-1 p-1 bg-yellow-100/50 dark:bg-yellow-900/20 rounded">
                                                <span className="font-medium">Sugerencia:</span> {aiResult.suggestedFix}
                                              </div>
                                            )}
                                            {aiResult.correctOptionShouldBe && (
                                              <div className="mt-1 p-1.5 bg-orange-100/50 dark:bg-orange-900/20 rounded">
                                                <div className="font-medium text-orange-600 dark:text-orange-400 mb-1">
                                                  Respuesta correcta debería ser: {aiResult.correctOptionShouldBe}
                                                </div>
                                                {aiResult.newExplanation && (
                                                  <div className="mb-2 p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded text-[10px]">
                                                    <span className="font-medium text-blue-700 dark:text-blue-300">Nueva explicación:</span>
                                                    <p className="mt-0.5 text-blue-600 dark:text-blue-400">{aiResult.newExplanation}</p>
                                                  </div>
                                                )}
                                                <button
                                                  onClick={() => applyAIFix(
                                                    question.id,
                                                    aiResult.correctOptionShouldBe,
                                                    aiResult.newExplanation || aiResult.suggestedFix,
                                                    aiResult.id,
                                                    log.article_number
                                                  )}
                                                  disabled={applyingFix === question.id}
                                                  className="px-2 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white text-[10px] rounded font-medium transition-colors"
                                                >
                                                  {applyingFix === question.id ? 'Aplicando...' : '🔧 Aplicar corrección'}
                                                </button>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}

                                    {/* Estado sin verificar */}
                                    {!aiResult && (
                                      <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                                        Sin verificar
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Mensaje si el filtro no tiene resultados */}
                  {historyData.length > 0 && historyFilter !== 'all' && historyData.filter(log => {
                    const summary = verificationSummaries[log.article_number]
                    if (historyFilter === 'pending') {
                      if (!summary) return true
                      const verified = (summary.ok || 0) + (summary.fixed || 0) + (summary.problems || 0)
                      return verified < (summary.total || 0)
                    }
                    if (historyFilter === 'problems') return summary && summary.problems > 0
                    if (historyFilter === 'ok') {
                      if (!summary) return false
                      const verified = (summary.ok || 0) + (summary.fixed || 0) + (summary.problems || 0)
                      return summary.problems === 0 && verified >= (summary.total || 0) && summary.total > 0
                    }
                    return true
                  }).length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-3">
                        {historyFilter === 'pending' ? '✨' : historyFilter === 'problems' ? '🎉' : '📭'}
                      </div>
                      <p className="font-medium">
                        {historyFilter === 'pending' && 'No hay artículos pendientes de verificar'}
                        {historyFilter === 'problems' && '¡No hay artículos con problemas!'}
                        {historyFilter === 'ok' && 'No hay artículos verificados todavía'}
                      </p>
                      <button
                        onClick={() => setHistoryFilter('all')}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Ver todos los artículos →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: REPARAR PREGUNTAS ===================== */}
        {activeTab === 'reparar' && (
          <div className="space-y-6">
            {(() => {
              // Recopilar preguntas pendientes, reparadas y descartadas
              const pendingQuestions = []
              const repairedQuestions = []
              const discardedQuestionsList = []

              Object.entries(historyAiResults).forEach(([articleNumber, aiResults]) => {
                Object.entries(aiResults).forEach(([questionId, result]) => {
                  if (result.isCorrect === false) {
                    const questions = historyQuestions[articleNumber] || []
                    const question = questions.find(q => q.id === questionId)
                    if (question) {
                      const item = {
                        ...question,
                        articleNumber,
                        aiResult: result
                      }
                      if (appliedFixes[questionId] || result.fixApplied) {
                        repairedQuestions.push(item)
                      } else if (discardedQuestions[questionId] || result.discarded) {
                        discardedQuestionsList.push(item)
                      } else {
                        pendingQuestions.push(item)
                      }
                    }
                  }
                })
              })

              if (loadingHistory || loadingRepairData) {
                return (
                  <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" />
                    <span className="ml-3 text-gray-500">Cargando preguntas...</span>
                  </div>
                )
              }

              const questionsToShow = repairFilter === 'pending'
                ? pendingQuestions
                : repairFilter === 'repaired'
                  ? repairedQuestions
                  : discardedQuestionsList

              return (
                <>
                  {/* Tarjetas de filtro */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Tarjeta Pendientes */}
                    <button
                      onClick={() => setRepairFilter('pending')}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        repairFilter === 'pending'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`text-3xl ${repairFilter === 'pending' ? '' : 'grayscale opacity-60'}`}>⚠️</div>
                          <div>
                            <h3 className={`font-semibold ${repairFilter === 'pending' ? 'text-orange-700 dark:text-orange-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              Pendientes de reparar
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Preguntas con errores detectados
                            </p>
                          </div>
                        </div>
                        <div className={`text-2xl font-bold ${
                          repairFilter === 'pending' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {pendingQuestions.length}
                        </div>
                      </div>
                    </button>

                    {/* Tarjeta Reparadas */}
                    <button
                      onClick={() => setRepairFilter('repaired')}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        repairFilter === 'repaired'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-300 dark:hover:border-green-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`text-3xl ${repairFilter === 'repaired' ? '' : 'grayscale opacity-60'}`}>✅</div>
                          <div>
                            <h3 className={`font-semibold ${repairFilter === 'repaired' ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              Preguntas reparadas
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Correcciones ya aplicadas
                            </p>
                          </div>
                        </div>
                        <div className={`text-2xl font-bold ${
                          repairFilter === 'repaired' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {repairedQuestions.length}
                        </div>
                      </div>
                    </button>

                    {/* Tarjeta Descartadas */}
                    <button
                      onClick={() => setRepairFilter('discarded')}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        repairFilter === 'discarded'
                          ? 'border-gray-500 bg-gray-50 dark:bg-gray-700/50'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`text-3xl ${repairFilter === 'discarded' ? '' : 'grayscale opacity-60'}`}>🚫</div>
                          <div>
                            <h3 className={`font-semibold ${repairFilter === 'discarded' ? 'text-gray-700 dark:text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              Descartadas
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Falsos positivos ignorados
                            </p>
                          </div>
                        </div>
                        <div className={`text-2xl font-bold ${
                          repairFilter === 'discarded' ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {discardedQuestionsList.length}
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Acciones rápidas para IDs */}
                  {pendingQuestions.length > 0 && repairFilter === 'pending' && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          IDs de preguntas pendientes ({pendingQuestions.length})
                        </h4>
                        <button
                          onClick={() => {
                            const ids = pendingQuestions.map(q => q.id).join('\n')
                            navigator.clipboard.writeText(ids)
                            alert(`${pendingQuestions.length} IDs copiados al portapapeles`)
                          }}
                          className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1"
                        >
                          <span>📋</span>
                          <span>Copiar IDs</span>
                        </button>
                      </div>
                      <div className="bg-white dark:bg-gray-900 rounded p-2 text-xs font-mono text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">
                        {pendingQuestions.map((q, i) => (
                          <div key={q.id} className="flex items-center gap-2 py-0.5">
                            <span className="text-gray-400">{i + 1}.</span>
                            <span className="select-all">{q.id}</span>
                            <span className="text-gray-400 text-xs">Art. {q.articleNumber}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lista de preguntas */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    {questionsToShow.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <div className="text-5xl mb-4">
                          {repairFilter === 'pending' ? '🎉' : repairFilter === 'repaired' ? '📋' : '🚫'}
                        </div>
                        <p className="text-lg font-medium">
                          {repairFilter === 'pending'
                            ? 'No hay preguntas pendientes'
                            : repairFilter === 'repaired'
                              ? 'No hay preguntas reparadas'
                              : 'No hay preguntas descartadas'}
                        </p>
                        <p className="text-sm mt-1">
                          {repairFilter === 'pending'
                            ? 'Todas las preguntas con problemas han sido reparadas o descartadas'
                            : repairFilter === 'repaired'
                              ? 'Aún no se ha reparado ninguna pregunta'
                              : 'No has descartado ningún falso positivo'}
                        </p>
                        {repairFilter === 'pending' && repairedQuestions.length > 0 && (
                          <button
                            onClick={() => setRepairFilter('repaired')}
                            className="mt-4 text-green-600 hover:text-green-700 dark:text-green-400 text-sm"
                          >
                            Ver {repairedQuestions.length} reparada{repairedQuestions.length !== 1 ? 's' : ''} →
                          </button>
                        )}
                        {repairFilter === 'repaired' && pendingQuestions.length > 0 && (
                          <button
                            onClick={() => setRepairFilter('pending')}
                            className="mt-4 text-orange-600 hover:text-orange-700 dark:text-orange-400 text-sm"
                          >
                            ← Ver {pendingQuestions.length} pendiente{pendingQuestions.length !== 1 ? 's' : ''}
                          </button>
                        )}
                        {repairFilter === 'discarded' && pendingQuestions.length > 0 && (
                          <button
                            onClick={() => setRepairFilter('pending')}
                            className="mt-4 text-orange-600 hover:text-orange-700 dark:text-orange-400 text-sm"
                          >
                            ← Ver {pendingQuestions.length} pendiente{pendingQuestions.length !== 1 ? 's' : ''}
                          </button>
                        )}
                        {repairFilter === 'pending' && repairedQuestions.length === 0 && discardedQuestionsList.length === 0 && (
                          <button
                            onClick={() => setActiveTab('verificar-preguntas')}
                            className="mt-4 text-purple-600 hover:text-purple-700 dark:text-purple-400 text-sm"
                          >
                            ← Ir a verificar preguntas
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 pb-3 border-b border-gray-200 dark:border-gray-700">
                          <span className={`font-medium ${
                            repairFilter === 'pending' ? 'text-orange-600 dark:text-orange-400' :
                            repairFilter === 'repaired' ? 'text-green-600 dark:text-green-400' :
                            'text-gray-600 dark:text-gray-400'
                          }`}>
                            {repairFilter === 'pending' ? '⚠️' : repairFilter === 'repaired' ? '✅' : '🚫'} {questionsToShow.length} pregunta{questionsToShow.length !== 1 ? 's' : ''} {
                              repairFilter === 'pending' ? 'pendientes' :
                              repairFilter === 'repaired' ? 'reparadas' : 'descartadas'
                            }
                          </span>
                        </div>

                        {questionsToShow.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`rounded-lg p-4 border ${
                              repairFilter === 'pending'
                                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            }`}
                          >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  repairFilter === 'pending'
                                    ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200'
                                    : 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                }`}>
                                  Art. {item.articleNumber}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  #{idx + 1}
                                </span>
                                {repairFilter === 'repaired' && item.aiResult?.verifiedAt && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    Reparada el {new Date(item.aiResult.verifiedAt).toLocaleDateString('es-ES')}
                                  </span>
                                )}
                              </div>
                              {item.aiResult?.confidence && (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  item.aiResult.confidence === 'alta' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                                  item.aiResult.confidence === 'media' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  Confianza: {item.aiResult.confidence}
                                </span>
                              )}
                              {/* Debug: mostrar datos crudos */}
                              <button
                                onClick={() => {
                                  console.log('=== DEBUG Pregunta ===')
                                  console.log('ID:', item.id)
                                  console.log('correct_option (actual):', item.correct_option, '→', ['A','B','C','D'][item.correct_option])
                                  console.log('AI isCorrect:', item.aiResult?.isCorrect)
                                  console.log('AI correctOptionShouldBe:', item.aiResult?.correctOptionShouldBe)
                                  console.log('AI result completo:', item.aiResult)
                                  alert(`Respuesta actual: ${['A','B','C','D'][item.correct_option]}\nAI isCorrect: ${item.aiResult?.isCorrect}\nAI shouldBe: ${item.aiResult?.correctOptionShouldBe}`)
                                }}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
                              >
                                🔍 Debug
                              </button>
                            </div>

                            {/* Pregunta */}
                            <p className="text-sm text-gray-900 dark:text-white font-medium mb-3">
                              {item.question_text}
                            </p>

                            {/* Opciones */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-xs">
                              {['A', 'B', 'C', 'D'].map((letter, i) => {
                                const optionKey = `option_${letter.toLowerCase()}`
                                const isCurrentCorrect = item.correct_option === i
                                const shouldBeCorrect = item.aiResult?.correctOptionShouldBe === letter

                                return (
                                  <div
                                    key={letter}
                                    className={`p-2 rounded ${
                                      shouldBeCorrect
                                        ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                                        : isCurrentCorrect && repairFilter === 'pending'
                                          ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                                          : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                    }`}
                                  >
                                    <span className="font-medium">{letter})</span> {item[optionKey]}
                                    {shouldBeCorrect && <span className="ml-1 text-green-600 dark:text-green-400">✓ Correcta</span>}
                                    {isCurrentCorrect && !shouldBeCorrect && repairFilter === 'pending' && <span className="ml-1 text-red-600 dark:text-red-400">✗ Anterior</span>}
                                  </div>
                                )
                              })}
                            </div>

                            {/* Explicación del problema */}
                            {item.aiResult?.explanation && (
                              <div className="text-xs bg-white dark:bg-gray-800 rounded p-3 mb-3 border border-gray-200 dark:border-gray-700">
                                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Análisis IA:</p>
                                <p className="text-gray-600 dark:text-gray-400">{item.aiResult.explanation}</p>
                              </div>
                            )}

                            {/* Cita del artículo */}
                            {item.aiResult?.articleQuote && (
                              <div className="text-xs bg-blue-50 dark:bg-blue-900/20 rounded p-3 mb-3 border border-blue-200 dark:border-blue-800">
                                <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">📜 Cita del artículo:</p>
                                <p className="text-blue-600 dark:text-blue-400 italic">"{item.aiResult.articleQuote}"</p>
                              </div>
                            )}

                            {/* Nueva explicación sugerida */}
                            {item.aiResult?.newExplanation && (
                              <div className="text-xs bg-purple-50 dark:bg-purple-900/20 rounded p-3 mb-3 border border-purple-200 dark:border-purple-800">
                                <p className="font-medium text-purple-700 dark:text-purple-300 mb-1">📝 {repairFilter === 'repaired' ? 'Explicación aplicada' : 'Nueva explicación'}:</p>
                                <p className="text-purple-600 dark:text-purple-400">{item.aiResult.newExplanation}</p>
                              </div>
                            )}

                            {/* Botón de aplicar (solo para pendientes) */}
                            {repairFilter === 'pending' && (() => {
                              // Detectar falso positivo: la IA dice que está mal pero sugiere la misma respuesta
                              const currentLetter = ['A', 'B', 'C', 'D'][item.correct_option]
                              const isFalsePositive = item.aiResult?.correctOptionShouldBe === currentLetter

                              if (isFalsePositive) {
                                return (
                                  <div className="pt-3 border-t border-yellow-200 dark:border-yellow-700">
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mb-3">
                                      <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium mb-1">
                                        ⚠️ Posible falso positivo
                                      </p>
                                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                        La IA marcó esta pregunta como incorrecta, pero sugiere la misma respuesta ({currentLetter}) que ya tiene.
                                        Esto puede ocurrir con preguntas de "doble negativo" donde la IA se confunde.
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => toggleDiscarded(item.id, item.articleNumber, true)}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                      >
                                        <span>🚫</span>
                                        <span>Descartar (falso positivo)</span>
                                      </button>
                                      {item.aiResult?.newExplanation && (
                                        <button
                                          onClick={() => applyAIFix(
                                            item.id,
                                            null, // No cambiar la respuesta
                                            item.aiResult?.newExplanation,
                                            item.aiResult?.id,
                                            item.articleNumber
                                          )}
                                          disabled={applyingFix === item.id}
                                          className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                        >
                                          {applyingFix === item.id ? (
                                            <Spinner size="sm" />
                                          ) : (
                                            <span>📝</span>
                                          )}
                                          <span>Solo actualizar explicación</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              }

                              return (
                                <div className="flex items-center justify-between pt-3 border-t border-orange-200 dark:border-orange-700">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Cambiar de <span className="font-medium text-red-600">{currentLetter}</span>
                                    {' → '}
                                    <span className="font-medium text-green-600">{item.aiResult?.correctOptionShouldBe}</span>
                                  </div>
                                  <button
                                    onClick={() => applyAIFix(
                                      item.id,
                                      item.aiResult?.correctOptionShouldBe,
                                      item.aiResult?.newExplanation || item.aiResult?.suggestedFix,
                                      item.aiResult?.id,
                                      item.articleNumber
                                    )}
                                    disabled={applyingFix === item.id}
                                    className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                  >
                                    {applyingFix === item.id ? (
                                      <>
                                        <Spinner size="sm" />
                                        <span>Aplicando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>🔧</span>
                                        <span>Aplicar corrección</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )
                            })()}

                            {/* Info de reparación (solo para reparadas) */}
                            {repairFilter === 'repaired' && (
                              <div className="flex items-center justify-between pt-3 border-t border-green-200 dark:border-green-700">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Respuesta cambiada a: <span className="font-medium text-green-600">{item.aiResult?.correctOptionShouldBe}</span>
                                </div>
                                <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                                  ✓ Corrección aplicada
                                </span>
                              </div>
                            )}

                            {/* Info de descarte (solo para descartadas) */}
                            {repairFilter === 'discarded' && (
                              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Marcada como falso positivo de la IA
                                </div>
                                <button
                                  onClick={() => toggleDiscarded(item.id, item.articleNumber, false)}
                                  className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded flex items-center gap-1"
                                >
                                  <span>↩️</span>
                                  <span>Restaurar a pendientes</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* Modal de comparación */}
      <CompareModal
        isOpen={!!compareArticle}
        onClose={() => setCompareArticle(null)}
        article={compareArticle}
        law={law}
        lawId={lawId}
      />

      {/* Modal de logs de errores */}
      {showErrorLogs && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowErrorLogs(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 my-8 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  🔍 Logs de errores de verificación
                </h3>
                <button
                  onClick={() => setShowErrorLogs(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {!errorLogs || errorLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-2">📭</div>
                    <p>No hay errores registrados para esta ley</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {errorLogs.map((log, idx) => (
                      <div key={log.id || idx} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-0.5 rounded font-medium">
                              Art. {log.article_number}
                            </span>
                            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                              {log.provider} / {log.model}
                            </span>
                            {log.error_type && (
                              <span className="text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded">
                                {log.error_type}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(log.created_at).toLocaleString('es-ES')}
                          </span>
                        </div>

                        <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-2">
                          {log.error_message}
                        </p>

                        {log.questions_count && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            Preguntas intentadas: {log.questions_count}
                          </p>
                        )}

                        {log.raw_response && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
                              Ver respuesta cruda (truncada)
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs text-gray-700 dark:text-gray-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                              {log.raw_response.substring(0, 2000)}
                              {log.raw_response.length > 2000 && '...'}
                            </pre>
                          </details>
                        )}

                        {log.tokens_used && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Tokens: {log.tokens_used.input_tokens || '?'} in / {log.tokens_used.output_tokens || '?'} out
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
