// components/Admin/TopicReviewTab.js
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

// Formatear nombre de oposición
const formatPositionName = (position) => {
  const names = {
    'auxiliar_administrativo': 'Auxiliar Administrativo del Estado (C2)',
    'administrativo': 'Administrativo del Estado (C1)',
    'gestion': 'Gestión del Estado (A2)'
  }
  return names[position] || position.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export default function TopicReviewTab() {
  const router = useRouter()
  const [positions, setPositions] = useState([])
  const [selectedPosition, setSelectedPosition] = useState('')
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchFilter, setSearchFilter] = useState('')

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

  // Cargar oposiciones disponibles
  useEffect(() => {
    loadPositions()
    loadAiConfig()
    loadVerificationQueue()

    // Polling para actualizar progreso de verificaciones cada 10 segundos
    const interval = setInterval(loadVerificationQueue, 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        // Seleccionar primera oposición por defecto
        if (data.positions?.length > 0) {
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
          c.has_key &&
          c.available_models?.some(m => m.status === 'working')
        )
        setAiConfigs(activeConfigs)

        if (activeConfigs.length > 0) {
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
    const config = aiConfigs.find(c => c.provider === provider)
    const workingModel = config?.available_models?.find(m => m.status === 'working')
    if (workingModel) {
      setSelectedModel(workingModel.id)
    }
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
  const verifyTopicPending = async (topicId, e) => {
    e.stopPropagation()
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            📚 Revisión de Temas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            Verificar preguntas organizadas por tema con IA
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Selector de oposición */}
          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
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
          return acc
        }, { total: 0, pending: 0, perfect: 0 })

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

                      {/* Botón verificar pendientes o estado de cola */}
                      {(() => {
                        const queueStatus = getTopicQueueStatus(topic.id)

                        // Si está en cola o procesándose
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

                        // Si hay pendientes y hay IA configurada, mostrar botón
                        if (topic.stats?.pending > 0 && aiConfigs.length > 0) {
                          return (
                            <button
                              onClick={(e) => verifyTopicPending(topic.id, e)}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded flex items-center gap-1 shrink-0"
                              title={`Verificar ${topic.stats.pending} pendientes con IA (en background)`}
                            >
                              🤖 Verificar ({topic.stats.pending})
                            </button>
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
    </div>
  )
}
