// app/admin/calidad/page.tsx - Página de control de calidad de preguntas
'use client'

import { useState, useEffect, useCallback } from 'react'

interface QualityIssue {
  id: string
  question_text: string
  field: string
}

interface CheckResult {
  count: number
  questions: QualityIssue[]
}

interface QualityData {
  success: boolean
  totalIssues: number
  checks: {
    empty_options: CheckResult
    banned_words: CheckResult
    pending_explanation: CheckResult
    missing_article: CheckResult
    missing_image: CheckResult
    excel_typo: CheckResult
    cramped_explanation: CheckResult
    copied_explanation: CheckResult
  }
}

const CHECK_CONFIG = {
  empty_options: {
    title: 'Opciones vacías',
    description: 'Preguntas con alguna opción A/B/C/D sin texto',
    icon: '⚠️',
  },
  banned_words: {
    title: 'Palabras prohibidas',
    description: 'Menciones a "opositatest" u otras marcas',
    icon: '🚫',
  },
  pending_explanation: {
    title: 'Explicación pendiente',
    description: 'Explicaciones con texto "pendiente de explicación"',
    icon: '📝',
  },
  missing_article: {
    title: 'Sin artículo vinculado',
    description: 'Preguntas sin primary_article_id',
    icon: '🔗',
  },
  missing_image: {
    title: 'Imagen no disponible',
    description: 'Preguntas que referencian imágenes/capturas que no se muestran',
    icon: '🖼️',
  },
  excel_typo: {
    title: 'Función Excel mal escrita',
    description: 'Funciones sin punto: SIERROR→SI.ERROR, CONTARSI→CONTAR.SI, SUMARSI→SUMAR.SI',
    icon: '📊',
  },
  cramped_explanation: {
    title: 'Explicación apelotonada',
    description: 'Explicaciones de >400 caracteres sin ningún salto de línea (texto corrido ilegible)',
    icon: '📄',
  },
  copied_explanation: {
    title: 'Explicación copiada del artículo',
    description: 'Explicaciones con similarity >= 0.9 respecto al artículo vinculado',
    icon: '📋',
  },
} as const

type CheckKey = keyof typeof CHECK_CONFIG

function countColor(count: number): string {
  if (count === 0) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  if (count <= 5) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
}

function cardBorder(count: number): string {
  if (count === 0) return 'border-green-300 dark:border-green-700'
  if (count <= 5) return 'border-orange-300 dark:border-orange-700'
  return 'border-red-300 dark:border-red-700'
}

export default function CalidadPage() {
  const [data, setData] = useState<QualityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedChecks, setExpandedChecks] = useState<Set<CheckKey>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [markingForReview, setMarkingForReview] = useState(false)
  const [markResult, setMarkResult] = useState<string | null>(null)

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/admin/question-quality${refresh ? '?refresh=true' : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error desconocido')
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleCheck = (key: CheckKey) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const markCopiedForReview = async () => {
    if (!confirm('Esto marcará las explicaciones copiadas como "pending" en revisión de temas para que sean analizadas. Las que ya tengan un estado de error no se sobreescriben. ¿Continuar?')) return
    setMarkingForReview(true)
    setMarkResult(null)
    try {
      const res = await fetch('/api/admin/question-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_copied_for_review' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setMarkResult(`${json.updated} preguntas marcadas como pendientes de revisión`)
      fetchData(true)
    } catch (err: any) {
      setMarkResult(`Error: ${err.message}`)
    } finally {
      setMarkingForReview(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Control de Calidad
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Detección automática de problemas en preguntas activas
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? 'Cargando...' : 'Refrescar'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Resumen */}
      {data && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total de problemas detectados
          </span>
          <span
            className={`px-3 py-1 rounded-full text-sm font-bold ${countColor(data.totalIssues)}`}
          >
            {data.totalIssues}
          </span>
        </div>
      )}

      {/* Tarjetas por check */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(CHECK_CONFIG) as CheckKey[]).map((key) => {
            const config = CHECK_CONFIG[key]
            const check = data.checks[key]
            const isExpanded = expandedChecks.has(key)

            return (
              <div
                key={key}
                className={`bg-white dark:bg-gray-800 border-2 rounded-lg overflow-hidden ${cardBorder(check.count)}`}
              >
                {/* Header de tarjeta */}
                <button
                  onClick={() => check.count > 0 && toggleCheck(key)}
                  className="w-full p-4 text-left flex items-center justify-between"
                  disabled={check.count === 0}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{config.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {config.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {config.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${countColor(check.count)}`}
                    >
                      {check.count}
                    </span>
                    {check.count > 0 && (
                      <span className="text-gray-400 text-xs">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </button>

                {/* Lista expandible */}
                {isExpanded && check.questions.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
                    {check.questions.map((q) => (
                      <div
                        key={q.id}
                        className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                            {q.question_text}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Campo: {q.field}
                          </p>
                        </div>
                        <button
                          onClick={() => copyId(q.id)}
                          className="flex-shrink-0 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-mono"
                          title="Copiar ID"
                        >
                          {copiedId === q.id ? 'Copiado!' : q.id.slice(0, 8)}
                        </button>
                      </div>
                    ))}
                    {check.count > check.questions.length && (
                      <div className="px-4 py-2 text-xs text-gray-400 text-center">
                        Mostrando {check.questions.length} de {check.count}
                      </div>
                    )}
                  </div>
                )}

                {/* Botón para marcar explicaciones copiadas como pendientes de revisión */}
                {key === 'copied_explanation' && check.count > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900">
                    <button
                      onClick={markCopiedForReview}
                      disabled={markingForReview}
                      className="w-full px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 text-xs font-medium"
                    >
                      {markingForReview
                        ? 'Marcando...'
                        : 'Marcar como pendientes en Revision Temas'}
                    </button>
                    {markResult && (
                      <p className={`text-xs mt-2 ${markResult.startsWith('Error') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                        {markResult}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Skeleton loading */}
      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
