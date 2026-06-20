// app/admin/errores-validacion/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ValidationErrorsResponse, ValidationErrorEntry } from '@/lib/api/admin-validation-errors/schemas'

type ErrorTypeFilter = 'timeout' | 'network' | 'db_connection' | 'validation' | 'not_found' | 'unknown' | 'auth' | 'forbidden' | 'rate_limit' | 'all'
type SeverityFilter = 'critical' | 'warning' | 'info' | 'all'

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  info: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

const ENDPOINT_LABELS: Record<string, string> = {
  '/api/answer': 'Answer',
  '/api/exam/validate': 'Exam',
  '/api/answer/psychometric': 'Psychometric',
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  timeout: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  network: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  db_connection: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  validation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  not_found: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  unknown: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
}

export default function ErroresValidacionPage() {
  const [data, setData] = useState<ValidationErrorsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [timeRange, setTimeRange] = useState<number>(7)
  const [endpoint, setEndpoint] = useState<string>('all')
  const [errorType, setErrorType] = useState<ErrorTypeFilter>('all')
  const [severity, setSeverity] = useState<SeverityFilter>('all')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const handleMarkReviewed = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/v2/admin/validation-errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Actualizar localmente
      setData(prev => prev ? {
        ...prev,
        errors: prev.errors.map(e => e.id === id ? { ...e, reviewedAt: new Date().toISOString() } : e),
      } : prev)
    } catch (err) {
      console.error('Error marcando revisado:', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        timeRange: String(timeRange),
        endpoint,
        errorType,
        limit: '200',
      })
      if (userIdFilter.trim()) {
        params.set('userId', userIdFilter.trim())
      }

      const res = await fetch(`/api/v2/admin/validation-errors?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [timeRange, endpoint, errorType, userIdFilter])

  // Filtrar por severity client-side
  const filteredErrors = data?.errors.filter(e =>
    severity === 'all' || e.severity === severity
  ) ?? []

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const truncate = (str: string | null, max: number) => {
    if (!str) return '-'
    return str.length > max ? str.slice(0, max) + '...' : str
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Errores de Validacion API
        </h1>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {loading ? 'Cargando...' : 'Recargar'}
        </button>
      </div>

      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard
            label="Sin revisar"
            value={data.unreviewedCount ?? 0}
            color="red"
          />
          <SummaryCard
            label="Total errores"
            value={data.summary.totalErrors}
            color="orange"
          />
          <SummaryCard
            label="Usuarios afectados"
            value={data.summary.affectedUsers}
            color="orange"
          />
          <SummaryCard
            label="Latencia media"
            value={data.summary.avgDurationMs ? `${Math.round(data.summary.avgDurationMs)}ms` : '-'}
            color="blue"
          />
          <SummaryCard
            label="Deploy versions"
            value={Object.keys(data.summary.byDeployVersion).length}
            color="purple"
          />
        </div>
      )}

      {/* Breakdown cards */}
      {data?.summary && data.summary.totalErrors > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BreakdownCard title="Por endpoint" data={data.summary.byEndpoint} labels={ENDPOINT_LABELS} />
          <BreakdownCard title="Por tipo de error" data={data.summary.byErrorType} />
          <BreakdownCard title="Por deploy version" data={data.summary.byDeployVersion} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Periodo</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value={1}>24h</option>
              <option value={3}>3 dias</option>
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Endpoint</label>
            <select
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">Todos</option>
              {data?.summary?.byEndpoint && Object.keys(data.summary.byEndpoint).sort().map(ep => (
                <option key={ep} value={ep}>{ep}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo error</label>
            <select
              value={errorType}
              onChange={(e) => setErrorType(e.target.value as ErrorTypeFilter)}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">Todos</option>
              <option value="timeout">Timeout</option>
              <option value="network">Network</option>
              <option value="db_connection">DB Connection</option>
              <option value="validation">Validation</option>
              <option value="not_found">Not Found</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Severidad</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">Todas</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">User ID</label>
            <input
              type="text"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              placeholder="UUID del usuario..."
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
          Error: {error}
        </div>
      )}

      {/* Table */}
      {data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filteredErrors.length} errores{severity !== 'all' ? ` (${severity})` : ''} en los ultimos {timeRange} dias
            </span>
          </div>

          {filteredErrors.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Sin errores en este periodo. Todo OK.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sev</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Endpoint</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mensaje</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Latencia</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deploy</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredErrors.map((err) => (
                    <ErrorRow
                      key={err.id}
                      error={err}
                      expanded={expandedRow === err.id}
                      onToggle={() => setExpandedRow(expandedRow === err.id ? null : err.id)}
                      onMarkReviewed={handleMarkReviewed}
                      formatDate={formatDate}
                      truncate={truncate}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// Sub-components
// ============================================

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    orange: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    purple: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
  }

  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  )
}

function BreakdownCard({
  title,
  data,
  labels,
}: {
  title: string
  data: Record<string, number>
  labels?: Record<string, string>
}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
      <div className="space-y-2">
        {entries.map(([key, count]) => (
          <div key={key} className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {labels?.[key] || key}
            </span>
            <span className="text-sm font-mono font-medium text-gray-900 dark:text-white ml-2">
              {count}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <span className="text-xs text-gray-400">Sin datos</span>
        )}
      </div>
    </div>
  )
}

function ErrorRow({
  error: err,
  expanded,
  onToggle,
  onMarkReviewed,
  formatDate,
  truncate,
}: {
  error: ValidationErrorEntry
  expanded: boolean
  onToggle: () => void
  onMarkReviewed: (id: string) => void
  formatDate: (iso: string) => string
  truncate: (str: string | null, max: number) => string
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${err.reviewedAt ? 'opacity-50' : ''}`}
      >
        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {err.reviewedAt ? '  ' : ''}{formatDate(err.createdAt)}
        </td>
        <td className="px-3 py-2">
          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[err.severity] || SEVERITY_COLORS.info}`}>
            {err.severity === 'critical' ? 'CRIT' : err.severity === 'warning' ? 'WARN' : 'INFO'}
          </span>
        </td>
        <td className="px-3 py-2 text-xs font-mono">
          {ENDPOINT_LABELS[err.endpoint] || err.endpoint}
        </td>
        <td className="px-3 py-2">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ERROR_TYPE_COLORS[err.errorType] || 'bg-gray-100 text-gray-800'}`}>
            {err.errorType}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">
          {truncate(err.errorMessage, 80)}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-gray-600 dark:text-gray-300">
          {err.durationMs ? `${err.durationMs}ms` : '-'}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-gray-500">
          {err.deployVersion || '-'}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-gray-500">
          {err.userId ? err.userId.slice(0, 8) + '...' : '-'}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-900">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium text-gray-500 dark:text-gray-400">Mensaje completo:</span>
                <pre className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border text-xs">
                  {err.errorMessage}
                </pre>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">User ID:</span>{' '}
                  <span className="font-mono text-gray-700 dark:text-gray-300">{err.userId || '-'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Question ID:</span>{' '}
                  <span className="font-mono text-gray-700 dark:text-gray-300">{err.questionId || '-'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Test ID:</span>{' '}
                  <span className="font-mono text-gray-700 dark:text-gray-300">{err.testId || '-'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">HTTP Status:</span>{' '}
                  <span className="font-mono text-gray-700 dark:text-gray-300">{err.httpStatus || '-'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Region:</span>{' '}
                  <span className="font-mono text-gray-700 dark:text-gray-300">{err.vercelRegion || '-'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">User Agent:</span>{' '}
                  <span className="text-gray-700 dark:text-gray-300">{truncate(err.userAgent, 100)}</span>
                </div>
                <div className="pt-2">
                  {err.reviewedAt ? (
                    <span className="text-green-600 dark:text-green-400 text-xs">
                      Revisado {formatDate(err.reviewedAt)}
                    </span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMarkReviewed(err.id) }}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      Marcar revisado
                    </button>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
