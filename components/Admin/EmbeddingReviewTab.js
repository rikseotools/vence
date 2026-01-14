// components/Admin/EmbeddingReviewTab.js
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

// Formatear nombre de oposición
const formatPositionName = (position) => {
  const names = {
    'auxiliar_administrativo': 'Aux. Admin.',
    'administrativo': 'Administrativo',
    'gestion': 'Gestión',
    'tramitacion_procesal': 'Tramitación',
    'auxilio_judicial': 'Auxilio Judicial'
  }
  return names[position] || position?.replace(/_/g, ' ')
}

export default function EmbeddingReviewTab() {
  const router = useRouter()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ total: 0, withTopic: 0, withoutTopic: 0, deactivated: 0 })
  const [filterPosition, setFilterPosition] = useState('all')
  const [filterHasTopic, setFilterHasTopic] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'wrong_article', 'topic_incorrecto'

  useEffect(() => {
    loadEmbeddingResults()
  }, [])

  const loadEmbeddingResults = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/embedding-review')
      const data = await response.json()

      if (data.success) {
        setQuestions(data.questions || [])
        const deactivatedCount = (data.questions || []).filter(q => q.topic_review_status === 'topic_incorrecto').length
        setStats({
          ...(data.stats || { total: 0, withTopic: 0, withoutTopic: 0 }),
          deactivated: deactivatedCount
        })
      } else {
        setError(data.error || 'Error cargando datos')
      }
    } catch (err) {
      setError('Error conectando con el servidor: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Obtener oposiciones únicas de las preguntas
  const getUniquePositions = () => {
    const positions = new Set()
    questions.forEach(q => {
      q.topics?.forEach(t => {
        if (t.position) positions.add(t.position)
      })
    })
    return Array.from(positions).sort()
  }

  // Filtrar preguntas
  const filteredQuestions = questions.filter(q => {
    // Filtro por oposición
    if (filterPosition !== 'all') {
      const hasPosition = q.topics?.some(t => t.position === filterPosition)
      if (!hasPosition) return false
    }

    // Filtro por tiene/no tiene topic
    if (filterHasTopic === 'with' && (!q.topics || q.topics.length === 0)) return false
    if (filterHasTopic === 'without' && q.topics && q.topics.length > 0) return false

    // Filtro por estado (topic_incorrecto vs wrong_article)
    if (filterStatus === 'topic_incorrecto' && q.topic_review_status !== 'topic_incorrecto') return false
    if (filterStatus === 'wrong_article' && q.topic_review_status === 'topic_incorrecto') return false

    return true
  })

  // Marcar como revisado manualmente
  const markAsReviewed = async (questionId, isCorrect) => {
    try {
      const response = await fetch('/api/admin/embedding-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          action: isCorrect ? 'mark_correct' : 'needs_llm_review'
        })
      })

      const data = await response.json()
      if (data.success) {
        // Actualizar lista local
        setQuestions(prev => prev.filter(q => q.id !== questionId))
        setStats(prev => ({
          ...prev,
          total: prev.total - 1
        }))
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error actualizando: ' + err.message)
    }
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🧠</span>
            Revisión por Embeddings
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Preguntas con posible artículo mal asignado (detectadas por similitud semántica)
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Total: <strong>{stats.total}</strong>
          </span>
          <span className="text-green-600 dark:text-green-400">
            Con topic: <strong>{stats.withTopic}</strong>
          </span>
          <span className="text-orange-600 dark:text-orange-400">
            Sin topic: <strong>{stats.withoutTopic}</strong>
          </span>
          {stats.deactivated > 0 && (
            <span className="text-red-600 dark:text-red-400">
              Desactivadas: <strong>{stats.deactivated}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterPosition}
          onChange={(e) => setFilterPosition(e.target.value)}
          className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2"
        >
          <option value="all">Todas las oposiciones</option>
          {getUniquePositions().map(pos => (
            <option key={pos} value={pos}>{formatPositionName(pos)}</option>
          ))}
          <option value="none">Sin oposición</option>
        </select>

        <select
          value={filterHasTopic}
          onChange={(e) => setFilterHasTopic(e.target.value)}
          className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2"
        >
          <option value="all">Todos</option>
          <option value="with">Con topic asignado</option>
          <option value="without">Sin topic asignado</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2"
        >
          <option value="all">Todos los estados</option>
          <option value="wrong_article">Solo artículo mal</option>
          <option value="topic_incorrecto">Desactivadas (topic incorrecto)</option>
        </select>

        <button
          onClick={loadEmbeddingResults}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-1"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Cargando preguntas...</span>
        </div>
      )}

      {/* Lista de preguntas */}
      {!loading && filteredQuestions.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {questions.length === 0
            ? '✅ No hay preguntas pendientes de revisión por embeddings'
            : 'No hay preguntas con los filtros seleccionados'
          }
        </div>
      )}

      {!loading && filteredQuestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Mostrando {filteredQuestions.length} de {questions.length} preguntas
          </p>

          {filteredQuestions.map((q, idx) => (
            <div
              key={q.id}
              className={`rounded-lg shadow border p-4 ${
                q.topic_review_status === 'topic_incorrecto'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Header con pregunta */}
              <div className="flex items-start gap-3 mb-3">
                <span className="text-gray-400 text-sm font-mono">{idx + 1}</span>
                <div className="flex-1">
                  {q.topic_review_status === 'topic_incorrecto' && (
                    <span className="inline-block px-2 py-0.5 bg-red-600 text-white text-xs rounded mb-2">
                      🚫 DESACTIVADA - Topic incorrecto
                    </span>
                  )}
                  <p className="text-gray-900 dark:text-white text-sm">
                    {q.question_text}
                  </p>
                </div>
              </div>

              {/* Info de artículos */}
              <div className="flex flex-wrap gap-4 mb-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">Asignado:</span>
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                    {q.assigned_article} ({q.similarity}%)
                  </span>
                </div>
                {q.suggested_article && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Sugerido:</span>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                      {q.suggested_article} ({q.suggested_similarity}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Topics y oposiciones */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {q.topics && q.topics.length > 0 ? (
                  <>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">En:</span>
                    {q.topics.map((t, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
                        title={`T${t.topic_number}: ${t.topic_title}`}
                      >
                        {formatPositionName(t.position)} T{t.topic_number}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                    ⚠️ Sin topic asignado
                  </span>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => markAsReviewed(q.id, true)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                  title="El artículo asignado está correcto"
                >
                  ✅ Correcto
                </button>
                <button
                  onClick={() => markAsReviewed(q.id, false)}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded"
                  title="Necesita revisión más profunda con LLM"
                >
                  🤖 Revisar con LLM
                </button>
                <button
                  onClick={() => router.push(`/admin/revision-temas/pregunta/${q.id}`)}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
                  title="Ver detalle de la pregunta"
                >
                  👁️ Ver detalle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
