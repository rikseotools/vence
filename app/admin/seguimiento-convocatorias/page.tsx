// app/admin/seguimiento-convocatorias/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'

interface SeguimientoItem {
  id: string
  nombre: string
  slug: string | null
  shortName: string | null
  seguimientoUrl: string
  lastChecked: string | null
  changeStatus: string | null
  changeDetectedAt: string | null
  unreviewed: number
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Hace menos de 1h'
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'changed') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse">CAMBIO</span>
  }
  if (status === 'error') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">ERROR</span>
  }
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">OK</span>
}

export default function SeguimientoConvocatoriasPage() {
  const [items, setItems] = useState<SeguimientoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [lastCheckResult, setLastCheckResult] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/seguimiento-convocatorias')
      const json = await res.json()
      if (json.success) setItems(json.data)
    } catch (e) {
      console.error('Error cargando datos:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleManualCheck = async () => {
    setChecking(true)
    setLastCheckResult(null)
    try {
      const res = await fetch('/api/cron/check-seguimiento', {
        headers: { 'Authorization': `Bearer ${prompt('CRON_SECRET:')}` }
      })
      const json = await res.json()
      if (json.success) {
        setLastCheckResult(`Verificadas ${json.stats.checked} | Cambios: ${json.stats.changed} | Errores: ${json.stats.errors} | ${json.duration}`)
        await fetchData()
      } else {
        setLastCheckResult(`Error: ${json.error}`)
      }
    } catch (e) {
      setLastCheckResult(`Error: ${(e as Error).message}`)
    } finally {
      setChecking(false)
    }
  }

  const handleMarkReviewed = async (oposicionId: string) => {
    try {
      await fetch('/api/admin/seguimiento-convocatorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_reviewed', oposicionId }),
      })
      await fetchData()
    } catch (e) {
      console.error('Error:', e)
    }
  }

  const changedCount = items.filter(i => i.changeStatus === 'changed').length
  const errorCount = items.filter(i => i.changeStatus === 'error').length

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Seguimiento de Convocatorias
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitoreo de cambios en páginas oficiales de seguimiento
          </p>
        </div>
        <div className="flex items-center gap-3">
          {changedCount > 0 && (
            <span className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-sm font-medium px-3 py-1 rounded-full">
              {changedCount} cambio{changedCount !== 1 ? 's' : ''} pendiente{changedCount !== 1 ? 's' : ''}
            </span>
          )}
          {errorCount > 0 && (
            <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">
              {errorCount} error{errorCount !== 1 ? 'es' : ''}
            </span>
          )}
          <button
            onClick={handleManualCheck}
            disabled={checking}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {checking ? 'Verificando...' : 'Verificar ahora'}
          </button>
        </div>
      </div>

      {lastCheckResult && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
          {lastCheckResult}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No hay oposiciones con URL de seguimiento</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className={`bg-white dark:bg-gray-800 rounded-xl border p-4 sm:p-5 transition-all ${
                item.changeStatus === 'changed'
                  ? 'border-red-300 dark:border-red-700 shadow-md'
                  : item.changeStatus === 'error'
                    ? 'border-yellow-300 dark:border-yellow-700'
                    : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {item.shortName ?? item.nombre}
                    </h3>
                    <StatusBadge status={item.changeStatus} />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                    <div>Última verificación: {timeAgo(item.lastChecked)}</div>
                    {item.changeDetectedAt && (
                      <div className="text-red-600 dark:text-red-400 font-medium">
                        Cambio detectado: {timeAgo(item.changeDetectedAt)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={item.seguimientoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    Ver página
                  </a>
                  {item.changeStatus === 'changed' && (
                    <button
                      onClick={() => handleMarkReviewed(item.id)}
                      className="px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                    >
                      Marcar revisado
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
