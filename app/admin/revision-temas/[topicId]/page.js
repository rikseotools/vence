// app/admin/revision-temas/[topicId]/page.js
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

// Badge de estado de revisión - 8 estados legales + 4 estados técnicos
const ReviewStatusBadge = ({ status }) => {
  const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

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

// Badge para indicar ley virtual/técnica
const VirtualLawBadge = () => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200">
    💻 Contenido Técnico
  </span>
)

// Formatear nombre de oposición
const formatPositionName = (position) => {
  const names = {
    'auxiliar_administrativo': { name: 'Auxiliar Administrativo', group: 'C2', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' },
    'administrativo': { name: 'Administrativo del Estado', group: 'C1', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200' },
    'gestion': { name: 'Gestión del Estado', group: 'A2', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' }
  }
  return names[position] || { name: position, group: '', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' }
}

// Badge de oposición
const PositionBadge = ({ position }) => {
  const info = formatPositionName(position)
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${info.color}`}>
      🎯 {info.name} ({info.group})
    </span>
  )
}

export default function TopicDetailPage() {
  const params = useParams()
  const router = useRouter()
  const topicId = params.topicId

  const [topic, setTopic] = useState(null)
  const [laws, setLaws] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Selección de preguntas
  const [selectedQuestions, setSelectedQuestions] = useState(new Set())

  // Verificación IA
  const [verifying, setVerifying] = useState(false)
  const [verifyProgress, setVerifyProgress] = useState({ current: 0, total: 0 })
  const [verifyResults, setVerifyResults] = useState(null)

  // Actualización manual de estado
  const [updatingQuestionId, setUpdatingQuestionId] = useState(null)

  // Configuración de IA
  const [aiConfigs, setAiConfigs] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [loadingAiConfig, setLoadingAiConfig] = useState(true)

  // Filtros
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedLaws, setExpandedLaws] = useState(new Set())
  const [expandedArticles, setExpandedArticles] = useState(new Set())

  // Estados que se consideran "con problemas" (verificadas mal)
  const problemStatuses = [
    'bad_explanation', 'bad_answer', 'bad_answer_and_explanation',
    'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
    'tech_bad_explanation', 'tech_bad_answer', 'tech_bad_answer_and_explanation'
  ]

  // Cambiar filtro Y actualizar selección
  const handleFilterChange = (newFilter) => {
    setStatusFilter(newFilter)

    // Actualizar selección según el filtro
    if (newFilter === 'all') {
      // Seleccionar todas
      const allIds = new Set()
      laws.forEach(law => {
        law.articles?.forEach(article => {
          article.questions?.forEach(q => allIds.add(q.id))
        })
      })
      setSelectedQuestions(allIds)
    } else if (newFilter === 'pending') {
      // Solo pendientes
      const ids = new Set()
      laws.forEach(law => {
        law.articles?.forEach(article => {
          article.questions?.forEach(q => {
            if (q.review_status === 'pending') ids.add(q.id)
          })
        })
      })
      setSelectedQuestions(ids)
    } else if (newFilter === 'not_perfect') {
      // No perfectas
      const ids = new Set()
      laws.forEach(law => {
        law.articles?.forEach(article => {
          article.questions?.forEach(q => {
            if (q.review_status !== 'perfect' && q.review_status !== 'tech_perfect') {
              ids.add(q.id)
            }
          })
        })
      })
      setSelectedQuestions(ids)
    } else if (newFilter === 'with_problems') {
      // Con problemas
      const ids = new Set()
      laws.forEach(law => {
        law.articles?.forEach(article => {
          article.questions?.forEach(q => {
            if (problemStatuses.includes(q.review_status)) ids.add(q.id)
          })
        })
      })
      setSelectedQuestions(ids)
    } else {
      // Filtro específico (perfect, bad_answer, etc.)
      const ids = new Set()
      laws.forEach(law => {
        law.articles?.forEach(article => {
          article.questions?.forEach(q => {
            if (q.review_status === newFilter) ids.add(q.id)
          })
        })
      })
      setSelectedQuestions(ids)
    }
  }

  // Cargar datos
  useEffect(() => {
    if (topicId) {
      loadTopicDetail()
    }
  }, [topicId])

  // Cargar configuración de IA
  useEffect(() => {
    loadAiConfig()
  }, [])

  const loadAiConfig = async () => {
    try {
      setLoadingAiConfig(true)
      const response = await fetch('/api/admin/ai-config')
      const data = await response.json()

      if (data.success && data.configs) {
        // Filtrar solo proveedores activos con modelos funcionando
        const activeConfigs = data.configs.filter(c =>
          c.is_active &&
          c.has_key &&
          c.available_models?.some(m => m.status === 'working')
        )
        setAiConfigs(activeConfigs)

        // Seleccionar primer proveedor activo con modelo funcionando por defecto
        if (activeConfigs.length > 0) {
          const firstConfig = activeConfigs[0]
          setSelectedProvider(firstConfig.provider)

          // Seleccionar primer modelo que funciona
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

  const loadTopicDetail = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/topic-review/${topicId}`)
      const data = await response.json()

      if (data.success) {
        setTopic(data.topic)
        setLaws(data.laws || [])
        // Expandir todas las leyes por defecto
        if (data.laws?.length > 0) {
          setExpandedLaws(new Set(data.laws.map(l => l.id)))
        }
        // Seleccionar todas las preguntas por defecto
        const allQuestionIds = new Set()
        data.laws?.forEach(law => {
          law.articles?.forEach(article => {
            article.questions?.forEach(q => {
              allQuestionIds.add(q.id)
            })
          })
        })
        setSelectedQuestions(allQuestionIds)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error conectando con el servidor')
    } finally {
      setLoading(false)
    }
  }

  // Toggle selección de pregunta
  const toggleQuestion = (questionId) => {
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
  const selectAll = () => {
    const allIds = new Set()
    laws.forEach(law => {
      law.articles?.forEach(article => {
        article.questions?.forEach(q => {
          allIds.add(q.id)
        })
      })
    })
    setSelectedQuestions(allIds)
    setStatusFilter('all') // Mostrar todas
  }

  // Seleccionar todas las preguntas pendientes
  const selectAllPending = () => {
    const pendingIds = new Set()
    laws.forEach(law => {
      law.articles?.forEach(article => {
        article.questions?.forEach(q => {
          if (q.review_status === 'pending') {
            pendingIds.add(q.id)
          }
        })
      })
    })
    setSelectedQuestions(pendingIds)
    setStatusFilter('pending') // Activar filtro para verlas
  }

  // Seleccionar todas las preguntas con problemas (no perfectas y ya verificadas)
  const selectAllWithProblems = () => {
    const problemIds = new Set()
    const problemStatuses = [
      'bad_explanation', 'bad_answer', 'bad_answer_and_explanation',
      'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
      'tech_bad_explanation', 'tech_bad_answer', 'tech_bad_answer_and_explanation'
    ]
    laws.forEach(law => {
      law.articles?.forEach(article => {
        article.questions?.forEach(q => {
          if (problemStatuses.includes(q.review_status)) {
            problemIds.add(q.id)
          }
        })
      })
    })
    setSelectedQuestions(problemIds)
    setStatusFilter('with_problems') // Activar filtro para verlas
  }

  // Deseleccionar todas
  const deselectAll = () => {
    setSelectedQuestions(new Set())
    setStatusFilter('all') // Mostrar todas
  }

  // Contar totales para mostrar
  const getTotalQuestions = () => {
    let total = 0
    laws.forEach(law => {
      law.articles?.forEach(article => {
        total += article.questions?.length || 0
      })
    })
    return total
  }

  // Toggle todas las preguntas de una ley
  const toggleLawQuestions = (law, e) => {
    e.stopPropagation()
    const lawQuestionIds = []
    law.articles?.forEach(article => {
      article.questions?.forEach(q => lawQuestionIds.push(q.id))
    })

    const allSelected = lawQuestionIds.every(id => selectedQuestions.has(id))
    setSelectedQuestions(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        lawQuestionIds.forEach(id => newSet.delete(id))
      } else {
        lawQuestionIds.forEach(id => newSet.add(id))
      }
      return newSet
    })
  }

  // Verificar si todas las preguntas de una ley están seleccionadas
  const isLawFullySelected = (law) => {
    const lawQuestionIds = []
    law.articles?.forEach(article => {
      article.questions?.forEach(q => lawQuestionIds.push(q.id))
    })
    return lawQuestionIds.length > 0 && lawQuestionIds.every(id => selectedQuestions.has(id))
  }

  // Toggle todas las preguntas de un artículo
  const toggleArticleQuestions = (article, e) => {
    e.stopPropagation()
    const articleQuestionIds = article.questions?.map(q => q.id) || []

    const allSelected = articleQuestionIds.every(id => selectedQuestions.has(id))
    setSelectedQuestions(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        articleQuestionIds.forEach(id => newSet.delete(id))
      } else {
        articleQuestionIds.forEach(id => newSet.add(id))
      }
      return newSet
    })
  }

  // Verificar si todas las preguntas de un artículo están seleccionadas
  const isArticleFullySelected = (article) => {
    const articleQuestionIds = article.questions?.map(q => q.id) || []
    return articleQuestionIds.length > 0 && articleQuestionIds.every(id => selectedQuestions.has(id))
  }

  // Verificar preguntas seleccionadas (en lotes para mostrar progreso)
  const verifySelected = async () => {
    if (selectedQuestions.size === 0) return
    if (!selectedProvider || !selectedModel) {
      setError('Selecciona un proveedor y modelo de IA')
      return
    }

    try {
      setVerifying(true)
      setError(null)
      setVerifyResults(null)

      const questionIds = Array.from(selectedQuestions)
      const BATCH_SIZE = 10 // Procesar de 10 en 10
      const totalQuestions = questionIds.length

      setVerifyProgress({ current: 0, total: totalQuestions })

      // Dividir en lotes
      const batches = []
      for (let i = 0; i < questionIds.length; i += BATCH_SIZE) {
        batches.push(questionIds.slice(i, i + BATCH_SIZE))
      }

      // Acumular resultados de todos los lotes
      const allResults = []
      const allErrors = []
      const statusCounts = {
        perfect: 0, bad_explanation: 0, bad_answer: 0, bad_answer_and_explanation: 0,
        wrong_article: 0, wrong_article_bad_explanation: 0, wrong_article_bad_answer: 0, all_wrong: 0,
        tech_perfect: 0, tech_bad_explanation: 0, tech_bad_answer: 0, tech_bad_answer_and_explanation: 0
      }
      let totalTokens = { input: 0, output: 0, total: 0 }

      // Procesar cada lote
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]

        const response = await fetch('/api/topic-review/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionIds: batch,
            provider: selectedProvider,
            model: selectedModel
          })
        })

        const data = await response.json()

        if (data.success) {
          // Acumular resultados
          if (data.results) allResults.push(...data.results)
          if (data.errors) allErrors.push(...data.errors)

          // Sumar contadores de estado
          Object.keys(statusCounts).forEach(key => {
            if (data.summary?.[key]) statusCounts[key] += data.summary[key]
          })

          // Sumar tokens
          if (data.tokenUsage) {
            totalTokens.input += data.tokenUsage.input || 0
            totalTokens.output += data.tokenUsage.output || 0
            totalTokens.total += data.tokenUsage.total || 0
          }
        } else {
          // Si falla un lote, continuar con los demás pero registrar error
          allErrors.push({ batch: batchIndex, error: data.error })
        }

        // Actualizar progreso
        const processed = Math.min((batchIndex + 1) * BATCH_SIZE, totalQuestions)
        setVerifyProgress({ current: processed, total: totalQuestions })
      }

      // Combinar todos los resultados
      setVerifyResults({
        success: true,
        results: allResults,
        errors: allErrors.length > 0 ? allErrors : undefined,
        summary: {
          total: totalQuestions,
          verified: allResults.length,
          failed: allErrors.length,
          ...statusCounts
        },
        tokenUsage: totalTokens,
        provider: selectedProvider,
        model: selectedModel
      })

      // Recargar datos
      await loadTopicDetail()
      // Limpiar selección
      setSelectedQuestions(new Set())

    } catch (err) {
      setError('Error durante la verificación: ' + err.message)
    } finally {
      setVerifying(false)
    }
  }

  // Toggle expandir ley
  const toggleLaw = (lawId) => {
    setExpandedLaws(prev => {
      const newSet = new Set(prev)
      if (newSet.has(lawId)) {
        newSet.delete(lawId)
      } else {
        newSet.add(lawId)
      }
      return newSet
    })
  }

  // Toggle expandir artículo
  const toggleArticle = (articleId) => {
    setExpandedArticles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(articleId)) {
        newSet.delete(articleId)
      } else {
        newSet.add(articleId)
      }
      return newSet
    })
  }

  // Actualizar estado de pregunta manualmente
  const updateQuestionStatus = async (questionId, newStatus, isVirtualLaw = false) => {
    try {
      setUpdatingQuestionId(questionId)

      // Para leyes virtuales, usar estados tech_*
      const finalStatus = isVirtualLaw && newStatus === 'perfect' ? 'tech_perfect' : newStatus

      const response = await fetch('/api/topic-review/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, status: finalStatus })
      })

      const data = await response.json()

      if (data.success) {
        // Actualizar estado local inmediatamente
        setLaws(prevLaws => prevLaws.map(law => ({
          ...law,
          articles: law.articles?.map(article => ({
            ...article,
            questions: article.questions?.map(q =>
              q.id === questionId
                ? { ...q, review_status: finalStatus, verified_at: new Date().toISOString() }
                : q
            )
          }))
        })))
      } else {
        setError(data.error || 'Error actualizando estado')
      }
    } catch (err) {
      setError('Error de conexión: ' + err.message)
    } finally {
      setUpdatingQuestionId(null)
    }
  }

  // Filtrar preguntas por estado
  const filterQuestions = (questions) => {
    if (statusFilter === 'all') return questions
    if (statusFilter === 'not_perfect') {
      return questions.filter(q => q.review_status !== 'perfect' && q.review_status !== 'tech_perfect')
    }
    if (statusFilter === 'with_problems') {
      return questions.filter(q => problemStatuses.includes(q.review_status))
    }
    return questions.filter(q => q.review_status === statusFilter)
  }

  // Contar preguntas por estado
  const countByStatus = (questions, status) => {
    return questions.filter(q => q.review_status === status).length
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Cargando tema...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">❌ {error}</p>
        </div>
        <Link href="/admin/revision-temas" className="mt-4 inline-block text-blue-600 hover:underline">
          ← Volver a temas
        </Link>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/revision-temas"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-2 inline-block"
        >
          ← Volver a temas
        </Link>

        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Tema {topic?.topic_number}: {topic?.title}
          </h1>
          {topic?.position_type && (
            <PositionBadge position={topic.position_type} />
          )}
        </div>

        {/* Stats globales */}
        <div className="flex flex-wrap gap-3 mt-3 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            📚 {topic?.stats?.total_laws} leyes
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            📄 {topic?.stats?.total_articles} artículos
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            📊 {topic?.stats?.total_questions} preguntas
          </span>
          {topic?.stats?.perfect > 0 && (
            <span className="text-green-600 dark:text-green-400">
              ✅ {topic?.stats?.perfect} perfectas
            </span>
          )}
          {(topic?.stats?.bad_explanation > 0 || topic?.stats?.bad_answer > 0 || topic?.stats?.bad_answer_and_explanation > 0) && (
            <span className="text-orange-600 dark:text-orange-400">
              ⚠️ {(topic?.stats?.bad_explanation || 0) + (topic?.stats?.bad_answer || 0) + (topic?.stats?.bad_answer_and_explanation || 0)} con problemas
            </span>
          )}
          {(topic?.stats?.wrong_article > 0 || topic?.stats?.wrong_article_bad_explanation > 0 || topic?.stats?.wrong_article_bad_answer > 0 || topic?.stats?.all_wrong > 0) && (
            <span className="text-purple-600 dark:text-purple-400">
              🔗 {(topic?.stats?.wrong_article || 0) + (topic?.stats?.wrong_article_bad_explanation || 0) + (topic?.stats?.wrong_article_bad_answer || 0) + (topic?.stats?.all_wrong || 0)} art. mal
            </span>
          )}
          <span className="text-gray-500 dark:text-gray-400">
            ⏳ {topic?.stats?.pending} pendientes
          </span>
        </div>
      </div>

      {/* Controles de selección y verificación */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtros */}
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-2"
          >
            <option value="all">Todas las preguntas</option>
            <option value="pending">⏳ Solo pendientes</option>
            <option value="not_perfect">🚫 No perfectas (todo menos ✅)</option>
            <option value="with_problems">⚠️ Con problemas (verificadas mal)</option>
            <optgroup label="Estados Legales">
              <option value="perfect">✅ Perfectas</option>
              <option value="bad_explanation">📝 Explicación mal</option>
              <option value="bad_answer">❌ Respuesta mal</option>
              <option value="bad_answer_and_explanation">❌ Resp + Expl mal</option>
              <option value="wrong_article">🔗 Artículo mal</option>
              <option value="wrong_article_bad_explanation">🔗📝 Art + Expl mal</option>
              <option value="wrong_article_bad_answer">🔗❌ Art + Resp mal</option>
              <option value="all_wrong">💥 Todo mal</option>
            </optgroup>
            <optgroup label="Estados Técnicos">
              <option value="tech_perfect">💻✅ OK Técnico</option>
              <option value="tech_bad_explanation">💻📝 Expl mal</option>
              <option value="tech_bad_answer">💻❌ Resp mal</option>
              <option value="tech_bad_answer_and_explanation">💻❌ Resp+Expl mal</option>
            </optgroup>
          </select>

          {/* Contador selección */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>{selectedQuestions.size}/{getTotalQuestions()} seleccionadas</span>
          </div>

          <div className="flex-1" />

          {/* Selección */}
          <button
            onClick={selectAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Todas
          </button>
          <button
            onClick={selectAllPending}
            className="text-sm text-orange-600 dark:text-orange-400 hover:underline"
          >
            Pendientes
          </button>
          <button
            onClick={selectAllWithProblems}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Con problemas
          </button>
          <button
            onClick={deselectAll}
            className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
          >
            Ninguna
          </button>
        </div>

        {/* Selector de IA y botón verificar */}
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {loadingAiConfig ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Spinner size="sm" />
              <span>Cargando configuración IA...</span>
            </div>
          ) : aiConfigs.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
              <span>⚠️</span>
              <span>No hay proveedores de IA configurados.</span>
              <a href="/admin/ai" className="text-blue-600 hover:underline">Configurar →</a>
            </div>
          ) : (
            <>
              {/* Selector de proveedor */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">🤖</span>
                <select
                  value={selectedProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-1.5"
                >
                  {aiConfigs.map(config => (
                    <option key={config.provider} value={config.provider}>
                      {config.provider === 'openai' ? 'OpenAI' :
                       config.provider === 'anthropic' ? 'Anthropic' :
                       config.provider === 'google' ? 'Google' : config.provider}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de modelo */}
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg px-3 py-1.5"
              >
                {getAvailableModels().map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>

              <div className="flex-1" />

              {/* Botón verificar */}
              <button
                onClick={verifySelected}
                disabled={selectedQuestions.size === 0 || verifying || !selectedProvider || !selectedModel}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                {verifying ? (
                  <>
                    <Spinner size="sm" />
                    Verificando...
                  </>
                ) : (
                  <>
                    🤖 Verificar seleccionadas ({selectedQuestions.size})
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Barra de progreso durante verificación */}
        {verifying && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Verificando con IA...</span>
              <span>{verifyProgress.current}/{verifyProgress.total}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${verifyProgress.total > 0 ? (verifyProgress.current / verifyProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Resultados de verificación */}
        {verifyResults && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✅ Verificación completada: {verifyResults.summary?.verified} preguntas procesadas
            </p>
            <div className="flex flex-wrap gap-3 mt-2 text-xs">
              {verifyResults.summary?.perfect > 0 && (
                <span className="text-green-600">✅ Perfectas: {verifyResults.summary.perfect}</span>
              )}
              {verifyResults.summary?.bad_explanation > 0 && (
                <span className="text-yellow-600">📝 Expl mal: {verifyResults.summary.bad_explanation}</span>
              )}
              {verifyResults.summary?.bad_answer > 0 && (
                <span className="text-orange-600">❌ Resp mal: {verifyResults.summary.bad_answer}</span>
              )}
              {verifyResults.summary?.bad_answer_and_explanation > 0 && (
                <span className="text-red-600">❌ Ambos mal: {verifyResults.summary.bad_answer_and_explanation}</span>
              )}
              {verifyResults.summary?.wrong_article > 0 && (
                <span className="text-purple-600">🔗 Art mal: {verifyResults.summary.wrong_article}</span>
              )}
              {verifyResults.summary?.wrong_article_bad_explanation > 0 && (
                <span className="text-purple-600">🔗📝 Art+Expl: {verifyResults.summary.wrong_article_bad_explanation}</span>
              )}
              {verifyResults.summary?.wrong_article_bad_answer > 0 && (
                <span className="text-purple-600">🔗❌ Art+Resp: {verifyResults.summary.wrong_article_bad_answer}</span>
              )}
              {verifyResults.summary?.all_wrong > 0 && (
                <span className="text-red-700">💥 Todo mal: {verifyResults.summary.all_wrong}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista de leyes y artículos */}
      <div className="space-y-4" key={`laws-filter-${statusFilter}`}>
        {laws.filter(law => {
          // Pre-filtrar leyes que no tienen preguntas con el filtro actual
          if (statusFilter === 'all') return true
          const matchingQuestionsInLaw = law.articles?.reduce((sum, article) => {
            return sum + filterQuestions(article.questions || []).length
          }, 0) || 0
          return matchingQuestionsInLaw > 0
        }).map(law => (
          <div
            key={law.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Header de ley */}
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
              onClick={() => toggleLaw(law.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Checkbox de ley */}
                  <input
                    type="checkbox"
                    checked={isLawFullySelected(law)}
                    onChange={(e) => toggleLawQuestions(law, e)}
                    className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-lg">
                    {expandedLaws.has(law.id) ? '📂' : '📁'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {law.short_name}
                      </h3>
                      {law.is_virtual && <VirtualLawBadge />}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {law.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">{law.stats?.total_articles} arts.</span>
                  <span className="text-gray-500">{law.stats?.total_questions} preg.</span>
                  {law.stats?.needs_review > 0 && (
                    <span className="text-orange-600">⚠️ {law.stats.needs_review}</span>
                  )}
                  <span className="text-xl text-gray-400">
                    {expandedLaws.has(law.id) ? '▼' : '▶'}
                  </span>
                </div>
              </div>
            </div>

            {/* Artículos expandidos */}
            {expandedLaws.has(law.id) && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                {law.articles?.filter(article => {
                  // Pre-filtrar artículos que no tienen preguntas con el filtro actual
                  if (statusFilter === 'all') return true
                  return filterQuestions(article.questions || []).length > 0
                }).map(article => {
                  const filteredQuestions = filterQuestions(article.questions || [])
                  return (
                    <div key={article.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      {/* Header de artículo */}
                      <div
                        className="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center justify-between"
                        onClick={() => toggleArticle(article.id)}
                      >
                        <div className="flex items-center gap-2">
                          {/* Checkbox de artículo */}
                          <input
                            type="checkbox"
                            checked={isArticleFullySelected(article)}
                            onChange={(e) => toggleArticleQuestions(article, e)}
                            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-gray-400">
                            {expandedArticles.has(article.id) ? '▼' : '▶'}
                          </span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Art. {article.article_number}
                          </span>
                          {article.title && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                              - {article.title}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">{article.stats?.total} preg.</span>
                          {article.stats?.perfect > 0 && (
                            <span className="text-green-600">✅{article.stats.perfect}</span>
                          )}
                          {(article.stats?.bad_answer > 0 || article.stats?.bad_explanation > 0 || article.stats?.bad_answer_and_explanation > 0) && (
                            <span className="text-orange-600">⚠️{(article.stats.bad_answer || 0) + (article.stats.bad_explanation || 0) + (article.stats.bad_answer_and_explanation || 0)}</span>
                          )}
                          {article.stats?.pending > 0 && (
                            <span className="text-gray-400">⏳{article.stats.pending}</span>
                          )}
                        </div>
                      </div>

                      {/* Preguntas expandidas */}
                      {expandedArticles.has(article.id) && filteredQuestions.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 space-y-2">
                          {filteredQuestions.map(q => (
                            <div
                              key={q.id}
                              className={`p-3 rounded-lg border ${
                                selectedQuestions.has(q.id)
                                  ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700'
                                  : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={selectedQuestions.has(q.id)}
                                  onChange={() => toggleQuestion(q.id)}
                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />

                                <div className="flex-1 min-w-0">
                                  {/* Estado y pregunta */}
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <ReviewStatusBadge status={q.review_status} />

                                    {/* Botón marcar como perfecta (solo si no es perfecta ya) */}
                                    {q.review_status !== 'perfect' && q.review_status !== 'tech_perfect' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          updateQuestionStatus(q.id, 'perfect', law.is_virtual)
                                        }}
                                        disabled={updatingQuestionId === q.id}
                                        className="px-1.5 py-0.5 text-xs rounded bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/50 dark:hover:bg-green-900 dark:text-green-300 transition-colors disabled:opacity-50"
                                        title="Marcar como perfecta (verificación manual)"
                                      >
                                        {updatingQuestionId === q.id ? '...' : '✓ OK'}
                                      </button>
                                    )}

                                    {q.is_official_exam && (
                                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                                        Oficial
                                      </span>
                                    )}
                                    {/* Abrir pregunta en nueva pestaña */}
                                    <a
                                      href={`/pregunta/${q.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                      title="Abrir pregunta en nueva pestaña"
                                    >
                                      ↗️
                                    </a>
                                  </div>

                                  <a
                                    href={`/pregunta/${q.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                                  >
                                    {q.question_text}
                                  </a>

                                  {/* Info adicional */}
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                    <span>
                                      Respuesta: {['A', 'B', 'C', 'D'][q.correct_option]}
                                    </span>
                                    {q.verified_at && (
                                      <span>
                                        Verificada: {new Date(q.verified_at).toLocaleDateString('es-ES')}
                                      </span>
                                    )}
                                    {q.ai_verification?.confidence && (
                                      <span>
                                        Confianza: {q.ai_verification.confidence}
                                      </span>
                                    )}
                                  </div>

                                  {/* Análisis IA si existe */}
                                  {q.ai_verification?.analysis && q.review_status !== 'pending' && (
                                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs space-y-1">
                                      {/* Variables booleanas */}
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        <span className={q.ai_verification.article_ok ? 'text-green-600' : 'text-red-600'}>
                                          Art: {q.ai_verification.article_ok ? '✅' : '❌'}
                                        </span>
                                        <span className={q.ai_verification.answer_ok ? 'text-green-600' : 'text-red-600'}>
                                          Resp: {q.ai_verification.answer_ok ? '✅' : '❌'}
                                        </span>
                                        <span className={q.ai_verification.explanation_ok ? 'text-green-600' : 'text-red-600'}>
                                          Expl: {q.ai_verification.explanation_ok ? '✅' : '❌'}
                                        </span>
                                      </div>
                                      <p className="text-gray-600 dark:text-gray-300">
                                        <strong>Análisis:</strong> {q.ai_verification.explanation || q.ai_verification.analysis}
                                      </p>
                                      {q.ai_verification.article_quote && (
                                        <p className="text-gray-500 dark:text-gray-400 italic">
                                          &quot;{q.ai_verification.article_quote}&quot;
                                        </p>
                                      )}
                                      {q.ai_verification.correct_article_suggestion && (
                                        <p className="text-purple-600 dark:text-purple-400">
                                          🔗 Artículo sugerido: {q.ai_verification.correct_article_suggestion}
                                        </p>
                                      )}
                                      {q.ai_verification.correct_option_should_be && (
                                        <p className="text-orange-600 dark:text-orange-400">
                                          ❌ Respuesta correcta: {q.ai_verification.correct_option_should_be}
                                        </p>
                                      )}
                                      {q.ai_verification.explanation_fix && (
                                        <p className="text-yellow-600 dark:text-yellow-400">
                                          📝 Problema explicación: {q.ai_verification.explanation_fix}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {expandedArticles.has(article.id) && filteredQuestions.length === 0 && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-4 text-center text-sm text-gray-500">
                          No hay preguntas con el filtro seleccionado
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {laws.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No hay leyes asociadas a este tema
        </div>
      )}

      {/* Mensaje cuando el filtro no tiene resultados */}
      {laws.length > 0 && statusFilter !== 'all' && laws.every(law => {
        const matching = law.articles?.reduce((sum, article) => {
          return sum + filterQuestions(article.questions || []).length
        }, 0) || 0
        return matching === 0
      }) && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-4xl mb-3">🔍</div>
          <p>No hay preguntas con el filtro seleccionado</p>
          <button
            onClick={() => handleFilterChange('all')}
            className="mt-3 text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            Ver todas las preguntas
          </button>
        </div>
      )}
    </div>
  )
}
