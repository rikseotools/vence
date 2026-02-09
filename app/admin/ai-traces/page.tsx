// app/admin/ai-traces/page.tsx
// Panel de administración de AI Chat Traces
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: { email?: string } | null
  supabase?: {
    auth: {
      getSession: () => Promise<{ data: { session: { access_token: string } | null } }>
    }
  }
}

// ============================================
// TIPOS
// ============================================

interface TraceSummary {
  logId: string
  message: string
  createdAt: string
  feedback: string | null
  hadError: boolean
  hadDiscrepancy: boolean
  traceCount: number
  totalDurationMs: number | null
  errorCount: number
  modelUsed: string | null
  selectedDomain: string | null
}

interface TraceDetail {
  id: string
  traceType: string
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  inputData: Record<string, unknown>
  outputData: Record<string, unknown>
  metadata: Record<string, unknown>
  success: boolean | null
  errorMessage: string | null
  sequenceNumber: number
  parentTraceId: string | null
}

interface TraceTreeNode {
  id: string
  type: string
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  input: Record<string, unknown>
  output: Record<string, unknown>
  metadata: Record<string, unknown>
  success: boolean
  error: string | null
  sequenceNumber: number
  children: TraceTreeNode[]
}

interface LogDetail {
  log: {
    id: string
    userId: string | null
    message: string
    fullResponse: string | null
    responseTimeMs: number | null
    tokensUsed: number | null
    feedback: string | null
    feedbackComment: string | null
    hadError: boolean | null
    hadDiscrepancy: boolean | null
    aiSuggestedAnswer: string | null
    dbAnswer: string | null
    detectedLaws: unknown[]
    questionContextLaw: string | null
    createdAt: string | null
  }
  traces: TraceDetail[]
  tree: TraceTreeNode[]
  stats: {
    totalDurationMs: number
    llmCallCount: number
    dbQueryCount: number
    errorCount: number
    totalTokensIn: number
    totalTokensOut: number
    dominiosEvaluados: number
    dominioSeleccionado: string | null
  }
}

// ============================================
// ICONOS
// ============================================

const TRACE_TYPE_ICONS: Record<string, string> = {
  routing: '🔀',
  domain: '📦',
  llm_call: '🤖',
  db_query: '🗄️',
  post_process: '⚙️',
  error: '❌',
}

const TRACE_TYPE_LABELS: Record<string, string> = {
  routing: 'Routing',
  domain: 'Dominio',
  llm_call: 'LLM Call',
  db_query: 'DB Query',
  post_process: 'Post-Process',
  error: 'Error',
}

// ============================================
// COMPONENTES
// ============================================

function TraceTreeView({ node, level = 0 }: { node: TraceTreeNode; level?: number }) {
  const [expanded, setExpanded] = useState(level === 0)

  const hasChildren = node.children && node.children.length > 0

  return (
    <div className={`${level > 0 ? 'ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-2' : ''}`}>
      <div
        className={`flex items-start gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
          !node.success ? 'bg-red-50 dark:bg-red-900/20' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
        ) : (
          <span className="text-gray-300 w-3"> </span>
        )}

        <span className="text-lg">{TRACE_TYPE_ICONS[node.type] || '📎'}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {TRACE_TYPE_LABELS[node.type] || node.type}
            </span>
            {node.durationMs !== null && (
              <span className="text-xs text-gray-500">
                {node.durationMs}ms
              </span>
            )}
            {!node.success && (
              <span className="text-xs text-red-500 font-medium">ERROR</span>
            )}
          </div>

          {expanded && (
            <div className="mt-2 text-xs space-y-2">
              {Object.keys(node.input).length > 0 && (
                <div>
                  <span className="text-gray-500 font-medium">Input:</span>
                  <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-xs">
                    {JSON.stringify(node.input, null, 2)}
                  </pre>
                </div>
              )}

              {Object.keys(node.output).length > 0 && (
                <div>
                  <span className="text-gray-500 font-medium">Output:</span>
                  <pre className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 rounded overflow-x-auto text-xs">
                    {JSON.stringify(node.output, null, 2)}
                  </pre>
                </div>
              )}

              {Object.keys(node.metadata).length > 0 && (
                <div>
                  <span className="text-gray-500 font-medium">Metadata:</span>
                  <pre className="mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded overflow-x-auto text-xs">
                    {JSON.stringify(node.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {node.error && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400">
                  <span className="font-medium">Error:</span> {node.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map((child) => (
            <TraceTreeView key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function LogDetailPanel({
  detail,
  onClose,
}: {
  detail: LogDetail
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Detalle del Trace</h2>
            <p className="text-sm text-gray-500">
              {new Date(detail.log.createdAt || '').toLocaleString('es-ES')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <div className="text-2xl font-bold">{detail.stats.totalDurationMs}ms</div>
              <div className="text-xs text-gray-500">Tiempo total</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <div className="text-2xl font-bold">{detail.stats.llmCallCount}</div>
              <div className="text-xs text-gray-500">Llamadas LLM</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <div className="text-2xl font-bold">
                {detail.stats.totalTokensIn + detail.stats.totalTokensOut}
              </div>
              <div className="text-xs text-gray-500">Tokens totales</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <div className="text-2xl font-bold">{detail.stats.dominioSeleccionado || '-'}</div>
              <div className="text-xs text-gray-500">Dominio</div>
            </div>
          </div>

          {/* Message */}
          <div>
            <h3 className="font-medium mb-2">Mensaje del usuario</h3>
            <p className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
              {detail.log.message}
            </p>
          </div>

          {/* Response Preview */}
          {detail.log.fullResponse && (
            <div>
              <h3 className="font-medium mb-2">Respuesta</h3>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm max-h-40 overflow-y-auto">
                {detail.log.fullResponse.substring(0, 500)}
                {detail.log.fullResponse.length > 500 && '...'}
              </div>
            </div>
          )}

          {/* Discrepancy Info */}
          {detail.log.hadDiscrepancy && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Discrepancia Detectada
              </h3>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">AI sugiere:</span> {detail.log.aiSuggestedAnswer}</p>
                <p><span className="font-medium">BD dice:</span> {detail.log.dbAnswer}</p>
              </div>
            </div>
          )}

          {/* Trace Tree */}
          <div>
            <h3 className="font-medium mb-2">Traces ({detail.traces.length})</h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded p-2">
              {detail.tree.length > 0 ? (
                detail.tree.map((node) => (
                  <TraceTreeView key={node.id} node={node} />
                ))
              ) : (
                <p className="text-gray-500 text-sm p-4 text-center">
                  No hay traces para este log
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function AdminAITracesPage() {
  const { user, supabase } = useAuth() as AuthContextType
  const router = useRouter()
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [logDetail, setLogDetail] = useState<LogDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Filtros
  const [hasErrors, setHasErrors] = useState<boolean | undefined>(undefined)
  const [hasFeedback, setHasFeedback] = useState<'positive' | 'negative' | 'any' | undefined>(undefined)
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  // Verificar acceso admin
  const isAdmin = user?.email?.endsWith('@vencemitfg.es') ||
                  user?.email === 'manueltrader@gmail.com' ||
                  false

  // Obtener token de sesión
  useEffect(() => {
    async function getSession() {
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      setAccessToken(session?.access_token || null)
    }
    getSession()
  }, [supabase])

  const fetchTraces = useCallback(async () => {
    if (!isAdmin || !accessToken) {
      console.log('fetchTraces skipped:', { isAdmin, hasToken: !!accessToken })
      return
    }

    console.log('fetchTraces: Using token:', accessToken?.substring(0, 20) + '...')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      params.set('offset', offset.toString())
      if (hasErrors !== undefined) params.set('hasErrors', hasErrors.toString())
      if (hasFeedback) params.set('hasFeedback', hasFeedback)

      const response = await fetch(`/api/admin/ai-traces?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', response.status, errorData)
        throw new Error(`Error ${response.status}: ${errorData.error || 'Unknown'}`)
      }

      const data = await response.json()
      setTraces(data.traces || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching traces:', error)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, accessToken, limit, offset, hasErrors, hasFeedback])

  const fetchLogDetail = useCallback(async (logId: string) => {
    if (!accessToken) return
    setLoadingDetail(true)
    try {
      const response = await fetch(`/api/admin/ai-traces/${logId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!response.ok) throw new Error('Error fetching log detail')

      const data = await response.json()
      setLogDetail(data)
    } catch (error) {
      console.error('Error fetching log detail:', error)
    } finally {
      setLoadingDetail(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchTraces()
  }, [fetchTraces])

  useEffect(() => {
    if (selectedLogId) {
      fetchLogDetail(selectedLogId)
    } else {
      setLogDetail(null)
    }
  }, [selectedLogId, fetchLogDetail])

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
          <p className="text-gray-500">No tienes permisos para ver esta pagina.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">AI Chat Traces</h1>
          <p className="text-gray-500">
            Sistema de observabilidad para el AI Chat
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Errores</label>
              <select
                value={hasErrors === undefined ? '' : hasErrors.toString()}
                onChange={(e) => {
                  const val = e.target.value
                  setHasErrors(val === '' ? undefined : val === 'true')
                  setOffset(0)
                }}
                className="px-3 py-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">Todos</option>
                <option value="true">Con errores</option>
                <option value="false">Sin errores</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Feedback</label>
              <select
                value={hasFeedback || ''}
                onChange={(e) => {
                  setHasFeedback(e.target.value as any || undefined)
                  setOffset(0)
                }}
                className="px-3 py-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">Todos</option>
                <option value="positive">Positivo</option>
                <option value="negative">Negativo</option>
                <option value="any">Con feedback</option>
              </select>
            </div>

            <div className="flex-1" />

            <div className="text-sm text-gray-500">
              {total} logs encontrados
            </div>
          </div>
        </div>

        {/* Lista de Traces */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando...</div>
          ) : traces.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No hay traces que mostrar
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {traces.map((trace) => (
                <div
                  key={trace.logId}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition ${
                    trace.hadError ? 'bg-red-50 dark:bg-red-900/10' : ''
                  }`}
                  onClick={() => setSelectedLogId(trace.logId)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {trace.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>
                          {new Date(trace.createdAt).toLocaleString('es-ES')}
                        </span>
                        {trace.selectedDomain && (
                          <>
                            <span>•</span>
                            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                              {trace.selectedDomain}
                            </span>
                          </>
                        )}
                        {trace.traceCount > 0 && (
                          <>
                            <span>•</span>
                            <span>{trace.traceCount} traces</span>
                          </>
                        )}
                        {trace.totalDurationMs && (
                          <>
                            <span>•</span>
                            <span>{trace.totalDurationMs}ms</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {trace.feedback === 'positive' && (
                        <span className="text-green-500">👍</span>
                      )}
                      {trace.feedback === 'negative' && (
                        <span className="text-red-500">👎</span>
                      )}
                      {trace.hadError && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded">
                          Error
                        </span>
                      )}
                      {trace.hadDiscrepancy && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 rounded">
                          Discrepancia
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginacion */}
          {total > limit && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-500">
                {offset + 1} - {Math.min(offset + limit, total)} de {total}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalle */}
      {selectedLogId && logDetail && (
        <LogDetailPanel
          detail={logDetail}
          onClose={() => setSelectedLogId(null)}
        />
      )}

      {/* Loading overlay */}
      {loadingDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-sm text-gray-500">Cargando detalle...</p>
          </div>
        </div>
      )}
    </div>
  )
}
