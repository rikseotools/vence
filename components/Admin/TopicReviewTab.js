// components/Admin/TopicReviewTab.js
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EmbeddingReviewTab from './EmbeddingReviewTab'

// Spinner component
const Spinner = ({ size = 'sm' }) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div className={`animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 ${sizeClasses[size]}`} />
  )
}

// Badge de estado de revisión - 8 estados legales + 4 estados técnicos
const ReviewStatusBadge = ({ status, small = false }) => {
  const baseClasses = small
    ? 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium'
    : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

  const statusConfig = {
    // Estados para leyes normales (8)
    perfect: {
      classes: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
      label: '✅ Perfecto'
    },
    bad_explanation: {
      classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
      label: '📝 Explicación mal'
    },
    bad_answer: {
      classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
      label: '❌ Respuesta mal'
    },
    bad_answer_and_explanation: {
      classes: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
      label: '❌ Resp + Expl mal'
    },
    wrong_article: {
      classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
      label: '🔗 Artículo mal'
    },
    wrong_article_bad_explanation: {
      classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
      label: '🔗📝 Art + Expl mal'
    },
    wrong_article_bad_answer: {
      classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
      label: '🔗❌ Art + Resp mal'
    },
    all_wrong: {
      classes: 'bg-red-200 text-red-900 dark:bg-red-900/70 dark:text-red-100',
      label: '💥 Todo mal'
    },
    // Estados para leyes virtuales/técnicas (4)
    tech_perfect: {
      classes: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200',
      label: '💻✅ OK Técnico'
    },
    tech_bad_explanation: {
      classes: 'bg-cyan-100 text-yellow-800 dark:bg-cyan-900/50 dark:text-yellow-200',
      label: '💻📝 Expl mal'
    },
    tech_bad_answer: {
      classes: 'bg-cyan-100 text-orange-800 dark:bg-cyan-900/50 dark:text-orange-200',
      label: '💻❌ Resp mal'
    },
    tech_bad_answer_and_explanation: {
      classes: 'bg-cyan-100 text-red-800 dark:bg-cyan-900/50 dark:text-red-200',
      label: '💻❌ Resp+Expl mal'
    },
    pending: {
      classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      label: '⏳ Pendiente'
    }
  }

  const config = statusConfig[status] || statusConfig.pending

  return (
    <span className={`${baseClasses} ${config.classes}`}>
      {config.label}
    </span>
  )
}

// Formatear nombre de oposición (usa config central)
import { getOposicionByPositionType } from '@/lib/config/oposiciones'

const formatPositionName = (position) => {
  if (position === 'psicotecnicos') return '🧠 Pruebas Psicotécnicas'
  return getOposicionByPositionType(position)?.name || position.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Formatear tiempo relativo "hace X días"
const formatTimeAgo = (dateString) => {
  if (!dateString) return null

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'hace 1 min' : `hace ${diffMinutes} min`
    }
    return diffHours === 1 ? 'hace 1 hora' : `hace ${diffHours} horas`
  }
  if (diffDays === 1) return 'hace 1 día'
  if (diffDays < 7) return `hace ${diffDays} días`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return weeks === 1 ? 'hace 1 semana' : `hace ${weeks} semanas`
  }
  const months = Math.floor(diffDays / 30)
  return months === 1 ? 'hace 1 mes' : `hace ${months} meses`
}

export default function TopicReviewTab() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('topics') // 'topics' | 'embeddings'
  const [positions, setPositions] = useState([])
  const [selectedPosition, setSelectedPosition] = useState('')
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [embeddingCount, setEmbeddingCount] = useState(0)

  // Estado para bloques colapsables
  const [expandedBlocks, setExpandedBlocks] = useState(new Set())

  // Configuración de IA para verificación
  const [aiConfigs, setAiConfigs] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [loadingAiConfig, setLoadingAiConfig] = useState(true)

  // Estado de verificación en cola (background)
  const [verificationQueue, setVerificationQueue] = useState({})
  const [loadingQueue, setLoadingQueue] = useState(false)

  // Estado de verificación global (toda la BD)
  const [verifyingAll, setVerifyingAll] = useState(false)
  const [verifyAllProgress, setVerifyAllProgress] = useState({ current: 0, total: 0 })
  const [globalStats, setGlobalStats] = useState({ total: 0, pending: 0, perfect: 0, problems: 0 })

  // Estado de verificación directa en navegador
  const [verifyingDirect, setVerifyingDirect] = useState({}) // { topicId: { current, total } }

  // Menú desplegable para elegir modo de verificación
  const [verifyMenuOpen, setVerifyMenuOpen] = useState(null) // topicId del menú abierto

  // Estado de verificación directa de BLOQUE en navegador
  const [verifyingBlockDirect, setVerifyingBlockDirect] = useState({}) // { blockId: { current, total } }
  const [blockMenuOpen, setBlockMenuOpen] = useState(null) // blockId del menú abierto

  // Cargar stats globales de preguntas únicas
  const loadGlobalStats = async () => {
    try {
      const response = await fetch('/api/topic-review/pending-all')
      const data = await response.json()
      if (data.success && data.stats) {
        setGlobalStats(data.stats)
      }
    } catch (err) {
      console.error('Error cargando stats globales:', err)
    }
  }

  // Cargar oposiciones disponibles
  useEffect(() => {
    loadPositions()
    loadAiConfig()
    loadVerificationQueue()
    loadEmbeddingCount()
    loadGlobalStats()

    // Polling para actualizar progreso de verificaciones cada 10 segundos
    const interval = setInterval(loadVerificationQueue, 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cargar conteo de preguntas pendientes por embeddings
  const loadEmbeddingCount = async () => {
    try {
      const response = await fetch('/api/admin/embedding-review')
      const data = await response.json()
      if (data.success) {
        setEmbeddingCount(data.stats?.total || 0)
      }
    } catch (err) {
      console.error('Error cargando conteo embeddings:', err)
    }
  }

  // Cargar temas cuando cambia la oposición
  useEffect(() => {
    if (selectedPosition) {
      loadTopics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPosition])

  const loadPositions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/topic-review')
      const data = await response.json()

      if (data.success) {
        setPositions(data.positions || [])
        // Restaurar oposición guardada o usar la primera por defecto
        const savedPosition = localStorage.getItem('topic_review_position')
        if (savedPosition && data.positions?.includes(savedPosition)) {
          setSelectedPosition(savedPosition)
        } else if (data.positions?.length > 0) {
          setSelectedPosition(data.positions[0])
        }
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error conectando con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const loadTopics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/topic-review?position=${encodeURIComponent(selectedPosition)}`)
      const data = await response.json()

      if (data.success) {
        setBlocks(data.blocks || [])
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error conectando con el servidor')
    } finally {
      setLoading(false)
    }
  }

  // Cargar configuración de IA
  const loadAiConfig = async () => {
    try {
      setLoadingAiConfig(true)
      const response = await fetch('/api/admin/ai-config')
      const data = await response.json()

      if (data.success && data.configs) {
        const activeConfigs = data.configs.filter(c =>
          c.is_active &&
          (c.api_key_encrypted || c.has_key) && // Soportar ambos campos
          c.available_models?.some(m => m.status === 'working')
        )
        setAiConfigs(activeConfigs)

        // Intentar cargar selección guardada en localStorage
        const savedProvider = localStorage.getItem('topic_review_ai_provider')
        const savedModel = localStorage.getItem('topic_review_ai_model')

        if (savedProvider && activeConfigs.find(c => c.provider === savedProvider)) {
          // Usar el proveedor guardado si aún está disponible
          setSelectedProvider(savedProvider)
          const config = activeConfigs.find(c => c.provider === savedProvider)
          const models = config?.available_models?.filter(m => m.status === 'working') || []

          if (savedModel && models.find(m => m.id === savedModel)) {
            setSelectedModel(savedModel)
          } else if (models.length > 0) {
            setSelectedModel(models[0].id)
          }
        } else if (activeConfigs.length > 0) {
          // Usar el primer proveedor disponible
          const firstConfig = activeConfigs[0]
          setSelectedProvider(firstConfig.provider)
          const workingModel = firstConfig.available_models?.find(m => m.status === 'working')
          if (workingModel) {
            setSelectedModel(workingModel.id)
          }
        }
      }
    } catch (err) {
      console.error('Error cargando config IA:', err)
    } finally {
      setLoadingAiConfig(false)
    }
  }

  // Obtener modelos del proveedor seleccionado
  const getAvailableModels = () => {
    const config = aiConfigs.find(c => c.provider === selectedProvider)
    return config?.available_models?.filter(m => m.status === 'working') || []
  }

  // Cambiar proveedor
  const handleProviderChange = (provider) => {
    setSelectedProvider(provider)
    localStorage.setItem('topic_review_ai_provider', provider)

    const config = aiConfigs.find(c => c.provider === provider)
    const workingModel = config?.available_models?.find(m => m.status === 'working')
    if (workingModel) {
      setSelectedModel(workingModel.id)
      localStorage.setItem('topic_review_ai_model', workingModel.id)
    }
  }

  // Cambiar modelo (también guardar)
  const handleModelChange = (model) => {
    setSelectedModel(model)
    localStorage.setItem('topic_review_ai_model', model)
  }

  // Cargar estado de la cola de verificaciones
  const loadVerificationQueue = async () => {
    try {
      const response = await fetch('/api/verification-queue')
      const data = await response.json()

      if (data.success && data.queue) {
        // Crear mapa de topic_id -> estado de verificación
        const queueMap = {}
        for (const item of data.queue) {
          queueMap[item.topic_id] = item
        }
        setVerificationQueue(queueMap)

        // Si hay alguna completada, recargar temas
        const hasCompleted = data.queue.some(q => q.status === 'completed')
        if (hasCompleted) {
          loadTopics()
        }
      }
    } catch (err) {
      console.error('Error cargando cola de verificaciones:', err)
    }
  }

  // Encolar verificación de un tema (se procesa en background)
  const verifyTopicQueue = async (topicId) => {
    setVerifyMenuOpen(null)
    if (!selectedProvider || !selectedModel) {
      setError('Selecciona un proveedor y modelo de IA')
      return
    }

    try {
      setError(null)

      const response = await fetch('/api/verification-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topicId,
          provider: selectedProvider,
          model: selectedModel
        })
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Error al encolar verificación')
        return
      }

      // Actualizar cola inmediatamente
      await loadVerificationQueue()

    } catch (err) {
      setError('Error al encolar verificación: ' + err.message)
    }
  }

  // Verificación directa en navegador (más rápida para pocas preguntas)
  const verifyTopicDirect = async (topicId, totalPending) => {
    setVerifyMenuOpen(null)
    if (!selectedProvider || !selectedModel) {
      setError('Selecciona un proveedor y modelo de IA')
      return
    }

    try {
      setError(null)
      setVerifyingDirect(prev => ({ ...prev, [topicId]: { current: 0, total: totalPending } }))

      // Obtener preguntas pendientes del tema
      const detailResponse = await fetch(`/api/topic-review?topic_id=${topicId}`)
      const detailData = await detailResponse.json()

      if (!detailData.success) {
        setError('Error obteniendo preguntas del tema')
        setVerifyingDirect(prev => {
          const newState = { ...prev }
          delete newState[topicId]
          return newState
        })
        return
      }

      // Filtrar solo las pendientes
      const pendingQuestions = detailData.questions?.filter(q =>
        !q.topic_review_status || q.topic_review_status === 'pending'
      ) || []

      if (pendingQuestions.length === 0) {
        setError('No hay preguntas pendientes en este tema')
        setVerifyingDirect(prev => {
          const newState = { ...prev }
          delete newState[topicId]
          return newState
        })
        return
      }

      // Verificar en lotes de 5
      const BATCH_SIZE = 5
      let processed = 0

      for (let i = 0; i < pendingQuestions.length; i += BATCH_SIZE) {
        const batch = pendingQuestions.slice(i, i + BATCH_SIZE)
        const batchIds = batch.map(q => q.id)

        const verifyResponse = await fetch('/api/topic-review/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionIds: batchIds,
            provider: selectedProvider,
            model: selectedModel,
            isPsychometric: selectedPosition === 'psicotecnicos'
          })
        })

        const verifyResult = await verifyResponse.json()

        // Detectar error de billing/créditos
        if (!verifyResult.success) {
          if (verifyResult.errorType === 'billing') {
            const providerName = verifyResult.provider === 'anthropic' ? 'Claude (Anthropic)' :
                                verifyResult.provider === 'openai' ? 'ChatGPT (OpenAI)' :
                                verifyResult.provider === 'google' ? 'Gemini (Google)' : verifyResult.provider

            setError(`❌ ${providerName} no tiene créditos. ${verifyResult.details?.questionsVerified || 0}/${verifyResult.details?.totalQuestions || 0} verificadas antes del error. Por favor:\n\n1. Añade créditos a ${providerName}\n2. O cambia a otro proveedor de IA en el selector arriba`)

            setVerifyingDirect(prev => {
              const newState = { ...prev }
              delete newState[topicId]
              return newState
            })

            // Recargar para mostrar las preguntas que sí se verificaron
            await loadTopics()
            return
          } else {
            console.error('Error verificando batch:', verifyResult.error)
          }
        }

        processed += batch.length
        setVerifyingDirect(prev => ({
          ...prev,
          [topicId]: { current: processed, total: pendingQuestions.length }
        }))
      }

      // Finalizar - limpiar estado y recargar temas
      setVerifyingDirect(prev => {
        const newState = { ...prev }
        delete newState[topicId]
        return newState
      })

      // Recargar lista de temas para actualizar stats
      await loadTopics()

    } catch (err) {
      setError('Error verificando: ' + err.message)
      setVerifyingDirect(prev => {
        const newState = { ...prev }
        delete newState[topicId]
        return newState
      })
    }
  }

  // Verificar TODA la base de datos con un solo botón
  const verifyAllDB = async () => {
    if (!selectedProvider || !selectedModel) {
      setError('Selecciona un proveedor y modelo de IA')
      return
    }
    if (verifyingAll) return
    if (!confirm('¿Verificar TODAS las preguntas pendientes de toda la base de datos? Esto puede tardar.')) return

    try {
      setVerifyingAll(true)
      setError(null)

      // Obtener TODAS las preguntas pendientes de la BD
      const response = await fetch('/api/topic-review/pending-all')
      const data = await response.json()

      if (!data.success || !data.questionIds?.length) {
        setError('No hay preguntas pendientes de verificar')
        setVerifyingAll(false)
        return
      }

      const allIds = data.questionIds
      setVerifyAllProgress({ current: 0, total: allIds.length })

      // Verificar en batches de 5
      const BATCH_SIZE = 5
      let processed = 0

      for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
        const batchIds = allIds.slice(i, i + BATCH_SIZE)

        const verifyResponse = await fetch('/api/topic-review/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionIds: batchIds,
            provider: selectedProvider,
            model: selectedModel,
          })
        })

        const verifyResult = await verifyResponse.json()

        if (!verifyResult.success && verifyResult.errorType === 'billing') {
          setError(`❌ Sin créditos. ${processed}/${allIds.length} verificadas.`)
          break
        }

        processed += batchIds.length
        setVerifyAllProgress({ current: processed, total: allIds.length })
      }

      await loadTopics()
      await loadGlobalStats()
    } catch (err) {
      setError('Error verificando: ' + err.message)
    } finally {
      setVerifyingAll(false)
    }
  }

  // Toggle menú de verificación
  const toggleVerifyMenu = (topicId, e) => {
    e.stopPropagation()
    setVerifyMenuOpen(prev => prev === topicId ? null : topicId)
  }

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setVerifyMenuOpen(null)
      setBlockMenuOpen(null)
    }
    if (verifyMenuOpen || blockMenuOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [verifyMenuOpen, blockMenuOpen])

  // Toggle menú de verificación de BLOQUE
  const toggleBlockMenu = (blockId, e) => {
    e.stopPropagation()
    setBlockMenuOpen(prev => prev === blockId ? null : blockId)
  }

  // Verificación directa de BLOQUE en navegador
  const verifyBlockDirect = async (blockId, topics, mode = 'pending') => {
    setBlockMenuOpen(null)
    if (!selectedProvider || !selectedModel) {
      setError('Selecciona un proveedor y modelo de IA')
      return
    }

    try {
      setError(null)

      // Recolectar todas las preguntas de todos los temas del bloque
      let allQuestions = []

      for (const topic of topics) {
        const detailResponse = await fetch(`/api/topic-review?topic_id=${topic.id}`)
        const detailData = await detailResponse.json()

        if (detailData.success && detailData.questions) {
          let questionsToAdd = detailData.questions

          // Filtrar según el modo
          if (mode === 'pending') {
            questionsToAdd = questionsToAdd.filter(q =>
              !q.topic_review_status || q.topic_review_status === 'pending'
            )
          } else if (mode === 'problems') {
            questionsToAdd = questionsToAdd.filter(q =>
              q.topic_review_status && !['pending', 'perfect', 'tech_perfect'].includes(q.topic_review_status)
            )
          }
          // mode === 'all' → no filtrar

          allQuestions = [...allQuestions, ...questionsToAdd]
        }
      }

      if (allQuestions.length === 0) {
        setError(`No hay preguntas ${mode === 'pending' ? 'pendientes' : mode === 'problems' ? 'con problemas' : ''} en este bloque`)
        return
      }

      // Iniciar verificación
      setVerifyingBlockDirect(prev => ({ ...prev, [blockId]: { current: 0, total: allQuestions.length } }))

      // Verificar en lotes de 5
      const BATCH_SIZE = 5
      let processed = 0

      for (let i = 0; i < allQuestions.length; i += BATCH_SIZE) {
        const batch = allQuestions.slice(i, i + BATCH_SIZE)
        const batchIds = batch.map(q => q.id)

        const verifyResponse = await fetch('/api/topic-review/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionIds: batchIds,
            provider: selectedProvider,
            model: selectedModel,
            isPsychometric: selectedPosition === 'psicotecnicos'
          })
        })

        const verifyResult = await verifyResponse.json()

        // Detectar error de billing/créditos
        if (!verifyResult.success) {
          if (verifyResult.errorType === 'billing') {
            const providerName = verifyResult.provider === 'anthropic' ? 'Claude (Anthropic)' :
                                verifyResult.provider === 'openai' ? 'ChatGPT (OpenAI)' :
                                verifyResult.provider === 'google' ? 'Gemini (Google)' : verifyResult.provider

            setError(`❌ ${providerName} no tiene créditos. ${processed}/${allQuestions.length} verificadas antes del error.`)

            setVerifyingBlockDirect(prev => {
              const newState = { ...prev }
              delete newState[blockId]
              return newState
            })

            await loadTopics()
            return
          } else {
            console.error('Error verificando batch:', verifyResult.error)
          }
        }

        processed += batch.length
        setVerifyingBlockDirect(prev => ({
          ...prev,
          [blockId]: { current: processed, total: allQuestions.length }
        }))
      }

      // Finalizar
      setVerifyingBlockDirect(prev => {
        const newState = { ...prev }
        delete newState[blockId]
        return newState
      })

      await loadTopics()

    } catch (err) {
      setError('Error verificando bloque: ' + err.message)
      setVerifyingBlockDirect(prev => {
        const newState = { ...prev }
        delete newState[blockId]
        return newState
      })
    }
  }

  // Obtener estado de verificación de un tema
  const getTopicQueueStatus = (topicId) => {
    return verificationQueue[topicId] || null
  }

  // Toggle expandir bloque
  const toggleBlock = (blockId) => {
    setExpandedBlocks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(blockId)) {
        newSet.delete(blockId)
      } else {
        newSet.add(blockId)
      }
      return newSet
    })
  }

  // Expandir todos los bloques
  const expandAllBlocks = () => {
    setExpandedBlocks(new Set(blocks.map(b => b.id)))
  }

  // Colapsar todos los bloques
  const collapseAllBlocks = () => {
    setExpandedBlocks(new Set())
  }

  // Navegar al detalle del tema
  const goToTopicDetail = (topicId) => {
    router.push(`/admin/revision-temas/${topicId}`)
  }

  // Filtrar temas por búsqueda
  const filterTopics = (topics) => {
    if (!searchFilter.trim()) return topics
    const search = searchFilter.toLowerCase()
    return topics.filter(t =>
      t.title.toLowerCase().includes(search) ||
      t.topic_number.toString().includes(search) ||
      t.laws?.some(l => l.short_name?.toLowerCase().includes(search))
    )
  }

  // Calcular progreso de verificación
  const getProgressPercent = (stats) => {
    if (!stats || stats.total_questions === 0) return 0
    const verified = stats.ok_literal + stats.ok_not_literal + stats.needs_review
    return Math.round((verified / stats.total_questions) * 100)
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            📚 Revisión de Temas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            Verificar preguntas organizadas por tema con IA
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('topics')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'topics'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          📋 Por Temas
        </button>
        <button
          onClick={() => setActiveTab('embeddings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'embeddings'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          🧠 Embeddings
          {embeddingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full text-xs">
              {embeddingCount}
            </span>
          )}
        </button>
      </div>

      {/* Contenido de la tab Embeddings */}
      {activeTab === 'embeddings' && (
        <EmbeddingReviewTab />
      )}

      {/* Contenido de la tab Temas */}
      {activeTab === 'topics' && (
        <>
        {/* Selectores de IA - SIEMPRE VISIBLE */}
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">🤖 Proveedor de IA:</span>

            {/* Selector de proveedor */}
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              disabled={loadingAiConfig || aiConfigs.length === 0}
              className="bg-white dark:bg-gray-700 border-2 border-blue-400 dark:border-blue-600 text-gray-900 dark:text-white text-sm font-medium rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            >
              {aiConfigs.length === 0 && <option>Cargando...</option>}
              {aiConfigs.map(config => (
                <option key={config.provider} value={config.provider}>
                  {config.provider === 'anthropic' ? '🔵 Claude (Anthropic)' :
                   config.provider === 'openai' ? '🟢 ChatGPT (OpenAI)' :
                   config.provider === 'google' ? '🔴 Gemini (Google)' : config.provider}
                </option>
              ))}
            </select>

            {/* Selector de modelo */}
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={loadingAiConfig || !selectedProvider}
              className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            >
              {getAvailableModels().length === 0 && <option>Sin modelos</option>}
              {getAvailableModels().map(model => (
                <option key={model.id} value={model.id}>
                  {model.name || model.id}
                </option>
              ))}
            </select>

            {aiConfigs.length === 0 && !loadingAiConfig && (
              <span className="text-xs text-red-600 dark:text-red-400">
                ⚠️ No hay proveedores de IA configurados
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div></div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Selector de oposición */}
          <select
            value={selectedPosition}
            onChange={(e) => {
              setSelectedPosition(e.target.value)
              localStorage.setItem('topic_review_position', e.target.value)
            }}
            className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {positions.map(pos => (
              <option key={pos} value={pos}>
                {formatPositionName(pos)}
              </option>
            ))}
          </select>

          {/* Búsqueda */}
          <div className="relative">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar tema..."
              className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg pl-8 pr-3 py-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-48"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Botones expandir/colapsar bloques */}
          {!loading && blocks.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={expandAllBlocks}
                className="px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Expandir todos los bloques"
              >
                ▼ Todos
              </button>
              <button
                onClick={collapseAllBlocks}
                className="px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Colapsar todos los bloques"
              >
                ▶ Todos
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">❌ {error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Cargando temas...</span>
        </div>
      )}

      {/* Bloque global: Toda la Base de Datos (preguntas únicas) */}
      {!loading && (
        <div className="mb-6">
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">🗄️</span>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Toda la Base de Datos
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">(preguntas únicas)</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                📊 {globalStats.total}
              </span>
              {globalStats.perfect > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  ✅ {globalStats.perfect}
                </span>
              )}
              {globalStats.pending > 0 && (
                <span className="text-gray-500 dark:text-gray-400">
                  ⏳ {globalStats.pending}
                </span>
              )}
              {globalStats.problems > 0 && (
                <span className="text-orange-500 dark:text-orange-400">
                  ⚠️ {globalStats.problems}
                </span>
              )}

              {verifyingAll ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg">
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                  {verifyAllProgress.current}/{verifyAllProgress.total}
                </span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); verifyAllDB(); }}
                  disabled={!selectedProvider || !selectedModel || globalStats.pending === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded-lg transition-colors"
                >
                  🔍 Verificar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bloques de temas */}
      {!loading && blocks.map(block => {
        const filteredTopics = filterTopics(block.topics)
        if (filteredTopics.length === 0 && searchFilter) return null
        const isExpanded = expandedBlocks.has(block.id)

        // Calcular stats del bloque
        const blockStats = filteredTopics.reduce((acc, topic) => {
          acc.total += topic.stats?.total_questions || 0
          acc.pending += topic.stats?.pending || 0
          acc.perfect += (topic.stats?.perfect || 0) + (topic.stats?.tech_perfect || 0)
          // Problemas: todo lo que no es perfect ni pending
          acc.problems += (topic.stats?.bad_explanation || 0) +
                         (topic.stats?.bad_answer || 0) +
                         (topic.stats?.bad_answer_and_explanation || 0) +
                         (topic.stats?.wrong_article || 0) +
                         (topic.stats?.wrong_article_bad_explanation || 0) +
                         (topic.stats?.wrong_article_bad_answer || 0) +
                         (topic.stats?.all_wrong || 0) +
                         (topic.stats?.tech_bad_explanation || 0) +
                         (topic.stats?.tech_bad_answer || 0) +
                         (topic.stats?.tech_bad_answer_and_explanation || 0)
          return acc
        }, { total: 0, pending: 0, perfect: 0, problems: 0 })

        // Estado de verificación del bloque
        const blockDirectStatus = verifyingBlockDirect[block.id]

        return (
          <div key={block.id} className="mb-4">
            {/* Header del bloque colapsable */}
            <div
              onClick={() => toggleBlock(block.id)}
              className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {block.title}
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({filteredTopics.length} temas)
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  📊 {blockStats.total}
                </span>
                {blockStats.perfect > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    ✅ {blockStats.perfect}
                  </span>
                )}
                {blockStats.pending > 0 && (
                  <span className="text-gray-500 dark:text-gray-400">
                    ⏳ {blockStats.pending}
                  </span>
                )}
                {blockStats.problems > 0 && (
                  <span className="text-orange-500 dark:text-orange-400">
                    ⚠️ {blockStats.problems}
                  </span>
                )}

                {/* Botón verificar bloque */}
                {(() => {
                  // Si está verificándose
                  if (blockDirectStatus) {
                    return (
                      <div
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Spinner size="sm" />
                        <span>{blockDirectStatus.current}/{blockDirectStatus.total}</span>
                      </div>
                    )
                  }

                  // Si hay preguntas y hay IA configurada
                  if (blockStats.total > 0 && aiConfigs.length > 0) {
                    return (
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => toggleBlockMenu(block.id, e)}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded flex items-center gap-1"
                          title="Reverificar preguntas del bloque"
                        >
                          🤖 Verificar
                          <span className="ml-1">▼</span>
                        </button>

                        {/* Menú desplegable */}
                        {blockMenuOpen === block.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-[200px]">
                            {blockStats.pending > 0 && (
                              <button
                                onClick={() => verifyBlockDirect(block.id, filteredTopics, 'pending')}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                              >
                                <span>⏳</span>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">Pendientes ({blockStats.pending})</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Sin verificar aún</div>
                                </div>
                              </button>
                            )}
                            {blockStats.problems > 0 && (
                              <button
                                onClick={() => verifyBlockDirect(block.id, filteredTopics, 'problems')}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${blockStats.pending > 0 ? 'border-t border-gray-100 dark:border-gray-700' : 'rounded-t-lg'}`}
                              >
                                <span>⚠️</span>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">Con problemas ({blockStats.problems})</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Reverificar errores</div>
                                </div>
                              </button>
                            )}
                            <button
                              onClick={() => verifyBlockDirect(block.id, filteredTopics, 'all')}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg flex items-center gap-2 border-t border-gray-100 dark:border-gray-700"
                            >
                              <span>🔄</span>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">Todas ({blockStats.total})</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Reverificar todo el bloque</div>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  }

                  return null
                })()}

                <span className="text-xl text-gray-400">{isExpanded ? '▼' : '▶'}</span>
              </div>
            </div>

            {/* Contenido del bloque (temas) */}
            {isExpanded && (
              <div className="flex flex-col gap-2 mt-2 pl-2">
                {filteredTopics.map(topic => (
                  <div
                    key={topic.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md transition-shadow"
                  >
                    {/* Fila única con toda la info */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      {/* Título del tema - clickeable para ir al detalle */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={() => goToTopicDetail(topic.id)}
                      >
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          <span className="text-gray-500 dark:text-gray-400">T{topic.topic_number}:</span> {topic.title}
                        </h3>
                      </div>

                      {/* Stats inline */}
                      <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                        <span className="text-gray-600 dark:text-gray-400">
                          📊 {topic.stats?.total_questions || 0}
                        </span>
                        {topic.stats?.perfect > 0 && (
                          <span className="text-green-600 dark:text-green-400">
                            ✅ {topic.stats.perfect}
                          </span>
                        )}
                        {/* Estados técnicos */}
                        {topic.stats?.tech_perfect > 0 && (
                          <span className="text-cyan-600 dark:text-cyan-400">
                            💻✅ {topic.stats.tech_perfect}
                          </span>
                        )}
                        {(topic.stats?.bad_explanation > 0 || topic.stats?.bad_answer > 0 || topic.stats?.bad_answer_and_explanation > 0) && (
                          <span className="text-orange-600 dark:text-orange-400">
                            ⚠️ {(topic.stats?.bad_explanation || 0) + (topic.stats?.bad_answer || 0) + (topic.stats?.bad_answer_and_explanation || 0)}
                          </span>
                        )}
                        {(topic.stats?.tech_bad_explanation > 0 || topic.stats?.tech_bad_answer > 0 || topic.stats?.tech_bad_answer_and_explanation > 0) && (
                          <span className="text-cyan-500 dark:text-cyan-400">
                            💻⚠️ {(topic.stats?.tech_bad_explanation || 0) + (topic.stats?.tech_bad_answer || 0) + (topic.stats?.tech_bad_answer_and_explanation || 0)}
                          </span>
                        )}
                        {(topic.stats?.wrong_article > 0 || topic.stats?.wrong_article_bad_explanation > 0 || topic.stats?.wrong_article_bad_answer > 0 || topic.stats?.all_wrong > 0) && (
                          <span className="text-purple-600 dark:text-purple-400">
                            🔗 {(topic.stats?.wrong_article || 0) + (topic.stats?.wrong_article_bad_explanation || 0) + (topic.stats?.wrong_article_bad_answer || 0) + (topic.stats?.all_wrong || 0)}
                          </span>
                        )}
                        {topic.stats?.pending > 0 && (
                          <span className="text-gray-500 dark:text-gray-400">
                            ⏳ {topic.stats.pending}
                          </span>
                        )}
                        {/* Indicador de última verificación */}
                        {topic.stats?.last_verified_at && (
                          <span className="text-gray-400 dark:text-gray-500 italic" title={new Date(topic.stats.last_verified_at).toLocaleString('es-ES')}>
                            🕐 {formatTimeAgo(topic.stats.last_verified_at)}
                          </span>
                        )}
                      </div>

                      {/* Leyes inline */}
                      <div className="flex flex-wrap gap-1 shrink-0">
                        {topic.laws?.slice(0, 3).map(law => (
                          <span
                            key={law.id}
                            className={`px-1.5 py-0.5 rounded text-xs ${
                              law.is_virtual
                                ? 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300'
                                : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                            }`}
                          >
                            {law.is_virtual && '💻'}{law.short_name}
                          </span>
                        ))}
                        {topic.laws?.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                            +{topic.laws.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Botón verificar pendientes o estado de cola/directo */}
                      {(() => {
                        const queueStatus = getTopicQueueStatus(topic.id)
                        const directStatus = verifyingDirect[topic.id]

                        // Si está verificándose directamente en navegador
                        if (directStatus) {
                          return (
                            <div className="px-2 py-1 bg-blue-600 text-white text-xs rounded flex items-center gap-1 shrink-0">
                              <Spinner size="sm" />
                              <span>
                                {directStatus.current}/{directStatus.total}
                              </span>
                            </div>
                          )
                        }

                        // Si está en cola o procesándose en background
                        if (queueStatus && ['pending', 'processing'].includes(queueStatus.status)) {
                          return (
                            <div className="px-2 py-1 bg-purple-600 text-white text-xs rounded flex items-center gap-1 shrink-0">
                              <Spinner size="sm" />
                              <span>
                                {queueStatus.status === 'pending' ? 'En cola...' :
                                  `${queueStatus.processed_questions}/${queueStatus.total_questions}`}
                              </span>
                            </div>
                          )
                        }

                        // Si hay pendientes y hay IA configurada, mostrar botón con menú
                        if (topic.stats?.pending > 0 && aiConfigs.length > 0) {
                          return (
                            <div className="relative shrink-0">
                              <button
                                onClick={(e) => toggleVerifyMenu(topic.id, e)}
                                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded flex items-center gap-1"
                                title={`Verificar ${topic.stats.pending} pendientes con IA`}
                              >
                                🤖 Verificar ({topic.stats.pending})
                                <span className="ml-1">▼</span>
                              </button>

                              {/* Menú desplegable */}
                              {verifyMenuOpen === topic.id && (
                                <div
                                  className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-[160px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => verifyTopicDirect(topic.id, topic.stats.pending)}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                                  >
                                    <span>🖥️</span>
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-white">En navegador</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">Más rápido, no cerrar</div>
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => verifyTopicQueue(topic.id)}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg flex items-center gap-2 border-t border-gray-100 dark:border-gray-700"
                                  >
                                    <span>📥</span>
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-white">En cola</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">Background, puedes cerrar</div>
                                    </div>
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        }

                        return null
                      })()}

                      {/* Flecha para ir al detalle */}
                      <span
                        className="text-gray-400 dark:text-gray-500 hidden sm:block cursor-pointer hover:text-blue-500"
                        onClick={() => goToTopicDetail(topic.id)}
                        title="Ver detalle del tema"
                      >
                        →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && filteredTopics.length === 0 && !searchFilter && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No hay temas en este bloque
              </p>
            )}
          </div>
        )
      })}

      {/* Sin resultados de búsqueda */}
      {!loading && searchFilter && blocks.every(b => filterTopics(b.topics).length === 0) && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No se encontraron temas con &quot;{searchFilter}&quot;
        </div>
      )}
        </>
      )}
    </div>
  )
}
