// app/admin/oep-signals/page.tsx
// Panel admin de señales de detección de OEPs (multi-sensor)
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { SignalRow, SignalStatus } from '@/lib/api/oep-signals/schemas'

interface ListResponse {
  success: boolean
  signals: SignalRow[]
  counts: { pending: number; applied: number; dismissed: number }
}

const SENSOR_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  llm_semantic: { label: 'LLM Semántico', emoji: '🤖', color: 'bg-purple-100 text-purple-800' },
  timeline_silence: { label: 'Silencio Timeline', emoji: '⏰', color: 'bg-orange-100 text-orange-800' },
  hash_change: { label: 'Cambio Hash', emoji: '📋', color: 'bg-yellow-100 text-yellow-800' },
  rss: { label: 'RSS Boletín', emoji: '📰', color: 'bg-blue-100 text-blue-800' },
  boe_api: { label: 'BOE API', emoji: '📄', color: 'bg-gray-100 text-gray-800' },
  google_cse: { label: 'Google', emoji: '🔎', color: 'bg-green-100 text-green-800' },
  manual: { label: 'Manual', emoji: '✍️', color: 'bg-slate-100 text-slate-800' },
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-red-100 text-red-800 border-red-300'
  if (score >= 60) return 'bg-orange-100 text-orange-800 border-orange-300'
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  return 'bg-gray-100 text-gray-700 border-gray-300'
}

export default function OepSignalsPage() {
  const [activeTab, setActiveTab] = useState<SignalStatus>('pending')
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadData = useCallback(async (status: SignalStatus) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/oep-signals?status=${status}&limit=200`)
      const json = await res.json() as ListResponse
      setData(json)
    } catch (err) {
      console.error('Error loading signals:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(activeTab)
  }, [activeTab, loadData])

  const handleReview = async (signalId: string, action: 'apply' | 'dismiss') => {
    setActionLoading(signalId)
    try {
      const res = await fetch('/api/admin/oep-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, action }),
      })
      const json = await res.json()
      if (json.success) {
        await loadData(activeTab)
      } else {
        alert('Error: ' + json.error)
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'))
    } finally {
      setActionLoading(null)
    }
  }

  const triggerCron = async (endpoint: 'detect-oep-llm' | 'detect-timeline-silence') => {
    if (!confirm(`¿Ejecutar cron "${endpoint}" ahora?`)) return
    try {
      const res = await fetch(`/api/admin/oep-signals/trigger-cron?cron=${endpoint}`, { method: 'POST' })
      const json = await res.json()
      alert(json.success ? `✅ ${endpoint} ejecutado` : `❌ ${json.error}`)
      await loadData(activeTab)
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'))
    }
  }

  const counts = data?.counts ?? { pending: 0, applied: 0, dismissed: 0 }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Detección de OEPs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Señales automáticas de nuevas convocatorias detectadas por múltiples sensores
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => triggerCron('detect-oep-llm')}
            className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium"
          >
            🤖 Ejecutar LLM scan
          </button>
          <button
            onClick={() => triggerCron('detect-timeline-silence')}
            className="px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-md font-medium"
          >
            ⏰ Check timeline
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4">
          {(['pending', 'applied', 'dismissed'] as SignalStatus[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {tab === 'pending' && 'Sin revisar'}
              {tab === 'applied' && 'Aplicadas'}
              {tab === 'dismissed' && 'Descartadas'}
              <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                {tab === 'pending' ? counts.pending : tab === 'applied' ? counts.applied : counts.dismissed}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : !data?.signals.length ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {activeTab === 'pending' ? '✓ No hay señales sin revisar' : 'Sin resultados'}
        </div>
      ) : (
        <div className="space-y-3">
          {data.signals.map(sig => {
            const sensor = SENSOR_LABELS[sig.sensorType] ?? { label: sig.sensorType, emoji: '❓', color: 'bg-gray-100' }
            return (
              <div
                key={sig.id}
                className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                  sig.confidenceScore >= 80 ? 'border-red-300' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sensor.color}`}>
                        {sensor.emoji} {sensor.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${scoreColor(sig.confidenceScore)}`}>
                        Score: {sig.confidenceScore}
                      </span>
                      {sig.isNovel && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800">
                          🆕 Nueva
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(sig.createdAt).toLocaleString('es-ES')}
                      </span>
                    </div>

                    <div className="font-semibold text-gray-900 dark:text-white mb-1">
                      {sig.oposicionNombre ?? 'Oposición sin nombre'}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {sig.signalSummary}
                    </div>

                    {/* Datos extraídos */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
                      {sig.detectedYear && <span>Año: <strong>{sig.detectedYear}</strong></span>}
                      {sig.detectedBocRef && <span>BOC: <strong>{sig.detectedBocRef}</strong></span>}
                      {sig.detectedPlazasLibre !== null && <span>Plazas libres: <strong>{sig.detectedPlazasLibre}</strong></span>}
                      {sig.detectedPlazasDiscapacidad !== null && <span>Discapac: <strong>{sig.detectedPlazasDiscapacidad}</strong></span>}
                      {sig.detectedFechaInscripcionFin && <span>Inscrip fin: <strong>{sig.detectedFechaInscripcionFin}</strong></span>}
                      {sig.detectedFechaExamen && <span>Examen: <strong>{sig.detectedFechaExamen}</strong></span>}
                      {sig.detectedEstado && <span>Estado: <strong>{sig.detectedEstado}</strong></span>}
                    </div>

                    {sig.sourceUrl && (
                      <div className="mt-2">
                        <a
                          href={sig.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          🔗 Ver página origen
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {activeTab === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleReview(sig.id, 'apply')}
                        disabled={actionLoading === sig.id}
                        className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md font-medium disabled:opacity-50"
                      >
                        ✓ Aplicar
                      </button>
                      <button
                        onClick={() => handleReview(sig.id, 'dismiss')}
                        disabled={actionLoading === sig.id}
                        className="px-3 py-1.5 text-sm bg-gray-400 hover:bg-gray-500 text-white rounded-md font-medium disabled:opacity-50"
                      >
                        ✗ Descartar
                      </button>
                    </div>
                  )}
                  {activeTab === 'applied' && sig.reviewedAt && (
                    <span className="text-xs text-gray-500">Aplicada {new Date(sig.reviewedAt).toLocaleDateString('es-ES')}</span>
                  )}
                  {activeTab === 'dismissed' && sig.reviewedAt && (
                    <span className="text-xs text-gray-500">Descartada {new Date(sig.reviewedAt).toLocaleDateString('es-ES')}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
