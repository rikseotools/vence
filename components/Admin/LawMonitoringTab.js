// components/admin/LawMonitoringTab.js
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Componente Spinner
const Spinner = ({ size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }
  
  return (
    <div className={`animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 ${sizeClasses[size]}`}>
    </div>
  )
}

export default function LawMonitoringTab() {
  const router = useRouter()
  const [laws, setLaws] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastCheck, setLastCheck] = useState(null)
  const [error, setError] = useState(null)
  const [checkStats, setCheckStats] = useState(null) // Estadísticas de última verificación
  const [lawFilter, setLawFilter] = useState('') // Filtro por texto de ley
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'boe_diff', 'changed', 'ok'
  const [aiVerificationStats, setAiVerificationStats] = useState({}) // { lawId: { lastVerified, pending, fixed } }
  const [statsLoaded, setStatsLoaded] = useState(false) // Si los stats de verificación están cargados
  const [showInfoModal, setShowInfoModal] = useState(false) // Modal de información

  const checkLawChanges = async () => {
    try {
      setLoading(true)
      setError(null)
      setCheckStats(null)

      // Usar endpoint optimizado (descarga parcial + cache de posiciones)
      const response = await fetch('/api/law-changes/check-optimized?skipRecent=false')
      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Error detectando cambios')
        return
      }

      // Guardar estadísticas de la verificación
      setCheckStats(data.stats)

      // Si hay cambios detectados, mostrar alerta
      if (data.changes && data.changes.length > 0) {
        console.log('🚨 Cambios detectados:', data.changes)
      }

      // Recargar lista de leyes con datos actualizados
      const reloadResponse = await fetch('/api/law-changes?readonly=true')
      const reloadData = await reloadResponse.json()

      if (reloadData.success) {
        setLaws(reloadData.results)
      }

      setLastCheck(new Date().toISOString())

    } catch (err) {
      setError('Error conectando con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const markAsReviewed = async (lawId) => {
    try {
      const response = await fetch('/api/law-changes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_reviewed',
          lawId: lawId
        })
      })

      const data = await response.json()

      if (data.success) {
        // Actualizar estado local
        setLaws(prev => prev.map(law =>
          law.id === lawId
            ? { ...law, changeStatus: 'reviewed' }
            : law
        ))
      } else {
        setError(data.error || 'Error marcando como revisado')
      }
    } catch (err) {
      setError('Error conectando con el servidor')
    }
  }

  // Navegar a la página de verificación de artículos
  const goToVerifyArticles = (lawId) => {
    router.push(`/admin/verificar-articulos/${lawId}`)
  }

  // Estado para sincronización
  const [syncingLaws, setSyncingLaws] = useState(new Set())
  const [syncResults, setSyncResults] = useState({}) // { lawId: { success, stats } }

  // Sincronizar todos los artículos de una ley desde el BOE
  const syncAllArticles = async (lawId, lawName) => {
    try {
      setSyncingLaws(prev => new Set([...prev, lawId]))
      setSyncResults(prev => ({ ...prev, [lawId]: null }))

      const response = await fetch('/api/verify-articles/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lawId })
      })

      const data = await response.json()

      setSyncResults(prev => ({
        ...prev,
        [lawId]: {
          success: data.success,
          stats: data.stats,
          error: data.error
        }
      }))

      if (data.success) {
        // Recargar estadísticas de verificación
        await loadAiVerificationStats()
      }

    } catch (err) {
      setSyncResults(prev => ({
        ...prev,
        [lawId]: { success: false, error: 'Error de conexión' }
      }))
    } finally {
      setSyncingLaws(prev => {
        const newSet = new Set(prev)
        newSet.delete(lawId)
        return newSet
      })
    }
  }

  // Cargar estadísticas de verificación IA por ley
  const loadAiVerificationStats = async () => {
    try {
      setStatsLoaded(false)
      const response = await fetch('/api/verify-articles/stats-by-law')
      const data = await response.json()
      if (data.success) {
        setAiVerificationStats(data.stats || {})
      }
    } catch (err) {
      console.error('Error cargando stats de verificación IA:', err)
    } finally {
      setStatsLoaded(true)
    }
  }

  // Cargar leyes iniciales sin verificar automáticamente
  useEffect(() => {
    const loadLaws = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/law-changes?readonly=true')
        const data = await response.json()

        if (data.success) {
          setLaws(data.results)
        } else {
          setError(data.error || 'Error obteniendo lista de leyes')
        }
      } catch (err) {
        setError('Error conectando con el servidor')
      } finally {
        setLoading(false)
      }
    }

    loadLaws()
    loadAiVerificationStats()
  }, [])

  // Detectar si hay leyes pendientes: cambios detectados O discrepancias BOE vs BD
  const hasUnreviewedChanges = laws.some(law =>
    law.changeStatus === 'changed' ||
    (aiVerificationStats[law.id]?.lastVerified && !aiVerificationStats[law.id]?.isOk)
  )

  // Ordenar leyes por fecha BOE (más recientes primero)
  const sortedLaws = [...laws].sort((a, b) => {
    // Ordenar por fecha BOE: primero las modificadas recientemente
    if (a.lastUpdateBOE && b.lastUpdateBOE) {
      // Convertir fechas DD/MM/YYYY a Date para comparar
      const dateA = new Date(a.lastUpdateBOE.split('/').reverse().join('-'))
      const dateB = new Date(b.lastUpdateBOE.split('/').reverse().join('-'))
      return dateB.getTime() - dateA.getTime() // Más reciente primero
    }

    // Si solo una tiene fecha BOE, ponerla primero
    if (a.lastUpdateBOE && !b.lastUpdateBOE) return -1
    if (!a.lastUpdateBOE && b.lastUpdateBOE) return 1

    // Si ninguna tiene fecha BOE, ordenar por nombre
    return a.law.localeCompare(b.law)
  })

  // Función para determinar el estado de una ley
  const getLawStatus = (law) => {
    if (law.changeStatus === 'changed') return 'changed'
    if (aiVerificationStats[law.id]?.lastVerified && !aiVerificationStats[law.id]?.isOk) return 'boe_diff'
    if (law.changeStatus === 'reviewed') return 'reviewed'
    // Solo marcar como OK si realmente se ha verificado y está bien
    if (aiVerificationStats[law.id]?.lastVerified && aiVerificationStats[law.id]?.isOk) return 'ok'
    // Si no se ha verificado, mostrar como pendiente
    return 'not_verified'
  }

  // Aplicar filtros (texto + estado)
  const filteredLaws = sortedLaws.filter(law => {
    // Filtro por texto
    const matchesText = !lawFilter.trim() ||
      law.law.toLowerCase().includes(lawFilter.toLowerCase()) ||
      law.name?.toLowerCase().includes(lawFilter.toLowerCase())

    // Filtro por estado
    const lawStatus = getLawStatus(law)
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'boe_diff' && lawStatus === 'boe_diff') ||
      (statusFilter === 'changed' && lawStatus === 'changed') ||
      (statusFilter === 'problems' && (lawStatus === 'boe_diff' || lawStatus === 'changed')) ||
      (statusFilter === 'not_verified' && lawStatus === 'not_verified') ||
      (statusFilter === 'ok' && (lawStatus === 'ok' || lawStatus === 'reviewed'))

    return matchesText && matchesStatus
  })

  // Contar leyes por estado
  const statusCounts = sortedLaws.reduce((acc, law) => {
    const status = getLawStatus(law)
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, { changed: 0, boe_diff: 0, reviewed: 0, ok: 0, not_verified: 0 })

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            🚨 Monitoreo de Leyes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            Detección automática de cambios en el BOE
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Búsqueda de ley */}
          <div className="relative">
            <input
              type="text"
              value={lawFilter}
              onChange={(e) => setLawFilter(e.target.value)}
              placeholder="Buscar ley..."
              className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg pl-8 pr-3 py-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-48"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
            {lawFilter && (
              <button
                onClick={() => setLawFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={checkLawChanges}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors text-sm sm:text-base flex-1 sm:flex-none flex items-center justify-center space-x-2"
            >
              {loading && <Spinner size="sm" />}
              <span>{loading ? 'Detectando...' : 'Detectar cambios BOE'}</span>
            </button>
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
              title="¿Qué hace este botón?"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Todas ({sortedLaws.length})
        </button>
        <button
          onClick={() => setStatusFilter('problems')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'problems'
              ? 'bg-red-600 text-white'
              : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900'
          }`}
        >
          🚨 Problemas ({statusCounts.changed + statusCounts.boe_diff})
        </button>
        <button
          onClick={() => setStatusFilter('boe_diff')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'boe_diff'
              ? 'bg-orange-600 text-white'
              : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:hover:bg-orange-900'
          }`}
        >
          BOE ≠ BD ({statusCounts.boe_diff})
        </button>
        <button
          onClick={() => setStatusFilter('changed')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'changed'
              ? 'bg-yellow-600 text-white'
              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900'
          }`}
        >
          Cambio BOE ({statusCounts.changed})
        </button>
        <button
          onClick={() => setStatusFilter('ok')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'ok'
              ? 'bg-green-600 text-white'
              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900'
          }`}
        >
          ✅ OK ({statusCounts.ok + statusCounts.reviewed})
        </button>
        {statusCounts.not_verified > 0 && (
          <button
            onClick={() => setStatusFilter('not_verified')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'not_verified'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
            }`}
          >
            ⏳ Sin verificar ({statusCounts.not_verified})
          </button>
        )}
      </div>

      {/* Indicador de carga */}
      {loading && (
        <div className="mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Spinner size="md" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Detectando cambios en {laws.length} leyes (optimizado)...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas de última verificación */}
      {checkStats && !loading && (
        <div className="mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-green-700 dark:text-green-300">
                ✅ Completado en {checkStats.duration || 'N/A'}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                📊 {checkStats.totalBytesFormatted}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                ⚡ {checkStats.efficiency}
              </span>
              {checkStats.changesDetected > 0 && (
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  🚨 {checkStats.changesDetected} cambios
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 mb-6">
          <p className="text-red-600 dark:text-red-400 text-sm sm:text-base">❌ {error}</p>
        </div>
      )}

      {lastCheck && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 mb-6">
          <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">
            📅 Última verificación: {new Date(lastCheck).toLocaleString('es-ES')}
          </p>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Ley
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Última verificación
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Último cambio BOE
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                BOE = BD
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredLaws.map((law) => (
              <tr 
                key={law.id}
                className={law.changeStatus === 'changed' ? 'bg-red-50 dark:bg-red-900/20' : ''}
              >
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                      {law.law}
                      {law.boeUrl && (
                        <a
                          href={law.boeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Abrir en BOE"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {law.name}
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  {law.status === 'error' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200">
                      ❌ Error
                    </span>
                  ) : law.changeStatus === 'changed' ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 animate-pulse">
                        🚨 Cambio detectado
                      </span>
                      {law.lastUpdateBOE && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          BOE actualizado: {law.lastUpdateBOE}
                        </div>
                      )}
                    </div>
                  ) : aiVerificationStats[law.id]?.lastVerified && !aiVerificationStats[law.id]?.isOk ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 animate-pulse">
                        🚨 BOE ≠ BD
                      </span>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Artículos pendientes
                      </div>
                    </div>
                  ) : law.changeStatus === 'reviewed' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200">
                      👁️ Revisado
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                      ✅ Sin cambios
                    </span>
                  )}
                </td>
                
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {law.lastChecked ? new Date(law.lastChecked).toLocaleString('es-ES') : 'Nunca'}
                </td>
                
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {law.lastUpdateBOE ? (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs">📅</span>
                      <span>{law.lastUpdateBOE}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600">Sin fecha</span>
                  )}
                </td>

                <td className="px-6 py-4 text-sm">
                  {aiVerificationStats[law.id]?.isOk ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                        ✅ Sí
                      </span>
                      {aiVerificationStats[law.id].lastVerified && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(aiVerificationStats[law.id].lastVerified).toLocaleDateString('es-ES')}
                        </div>
                      )}
                    </div>
                  ) : aiVerificationStats[law.id]?.lastVerified ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200">
                        ⚠️ Revisar
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(aiVerificationStats[law.id].lastVerified).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600 text-xs">No verificado</span>
                  )}
                </td>

                <td className="px-6 py-4 text-sm">
                  <div className="flex flex-col space-y-2">
                    {law.changeStatus === 'changed' && (
                      <button
                        onClick={() => markAsReviewed(law.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition-colors"
                      >
                        Marcar como revisado
                      </button>
                    )}
                    {/* Botón Sincronizar - para leyes con BOE ≠ BD o sin verificar (solo si stats cargados) */}
                    {statsLoaded && ((aiVerificationStats[law.id]?.lastVerified && !aiVerificationStats[law.id]?.isOk) || !aiVerificationStats[law.id]?.lastVerified) && (
                      <button
                        onClick={() => syncAllArticles(law.id, law.law)}
                        disabled={syncingLaws.has(law.id)}
                        className={`${!aiVerificationStats[law.id]?.lastVerified ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400' : 'bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400'} text-white px-3 py-1 rounded text-xs transition-colors flex items-center justify-center space-x-1`}
                      >
                        {syncingLaws.has(law.id) ? (
                          <>
                            <Spinner size="sm" />
                            <span>Sincronizando...</span>
                          </>
                        ) : (
                          <span>🔄 Sincronizar BOE</span>
                        )}
                      </button>
                    )}
                    {/* Resultado de sincronización */}
                    {syncResults[law.id] && (
                      <div className={`text-xs px-2 py-1 rounded ${
                        syncResults[law.id].success
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                      }`}>
                        {syncResults[law.id].success ? (
                          <span>+{syncResults[law.id].stats?.added || 0} 🔄{syncResults[law.id].stats?.updated || 0}</span>
                        ) : (
                          <span>❌ {syncResults[law.id].error}</span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => goToVerifyArticles(law.id)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs transition-colors"
                    >
                      📋 Verificar artículos
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {filteredLaws.map((law) => (
          <div 
            key={law.id}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow border ${
              law.changeStatus === 'changed' 
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' 
                : 'border-gray-200 dark:border-gray-700'
            } p-4`}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  {law.law}
                  {law.boeUrl && (
                    <a
                      href={law.boeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Abrir en BOE"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {law.name}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="mb-3">
              {law.status === 'error' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200">
                  ❌ Error
                </span>
              ) : law.changeStatus === 'changed' ? (
                <div className="space-y-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 animate-pulse">
                    🚨 Cambio detectado
                  </span>
                  {law.lastUpdateBOE && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      BOE actualizado: {law.lastUpdateBOE}
                    </div>
                  )}
                </div>
              ) : aiVerificationStats[law.id]?.lastVerified && !aiVerificationStats[law.id]?.isOk ? (
                <div className="space-y-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 animate-pulse">
                    🚨 BOE ≠ BD
                  </span>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Artículos pendientes
                  </div>
                </div>
              ) : law.changeStatus === 'reviewed' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200">
                  👁️ Revisado
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                  ✅ Sin cambios
                </span>
              )}
            </div>

            {/* Last Check */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              📅 Última verificación: {law.lastChecked ? new Date(law.lastChecked).toLocaleString('es-ES') : 'Nunca'}
            </div>

            {/* Last BOE Update */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              📋 Último cambio BOE: {law.lastUpdateBOE ? law.lastUpdateBOE : 'Sin fecha'}
            </div>

            {/* BOE = BD */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              BOE = BD:{' '}
              {aiVerificationStats[law.id]?.isOk ? (
                <>
                  <span className="text-green-600 dark:text-green-400 font-medium">✅ Sí</span>
                  {aiVerificationStats[law.id].lastVerified && (
                    <span>({new Date(aiVerificationStats[law.id].lastVerified).toLocaleDateString('es-ES')})</span>
                  )}
                </>
              ) : aiVerificationStats[law.id]?.lastVerified ? (
                <>
                  <span className="text-orange-600 dark:text-orange-400 font-medium">⚠️ Revisar</span>
                  <span>({new Date(aiVerificationStats[law.id].lastVerified).toLocaleDateString('es-ES')})</span>
                </>
              ) : (
                <span className="text-gray-400">No verificado</span>
              )}
            </div>

            {/* Action */}
            <div className="space-y-2">
              {law.changeStatus === 'changed' && (
                <button
                  onClick={() => markAsReviewed(law.id)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm transition-colors"
                >
                  Marcar como revisado
                </button>
              )}
              {/* Botón Sincronizar - para leyes con BOE ≠ BD o sin verificar (solo si stats cargados) */}
              {statsLoaded && ((aiVerificationStats[law.id]?.lastVerified && !aiVerificationStats[law.id]?.isOk) || !aiVerificationStats[law.id]?.lastVerified) && (
                <button
                  onClick={() => syncAllArticles(law.id, law.law)}
                  disabled={syncingLaws.has(law.id)}
                  className={`w-full ${!aiVerificationStats[law.id]?.lastVerified ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400' : 'bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400'} text-white px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-center space-x-2`}
                >
                  {syncingLaws.has(law.id) ? (
                    <>
                      <Spinner size="sm" />
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <span>🔄 Sincronizar BOE</span>
                  )}
                </button>
              )}
              {/* Resultado de sincronización */}
              {syncResults[law.id] && (
                <div className={`text-sm px-3 py-2 rounded-md ${
                  syncResults[law.id].success
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                }`}>
                  {syncResults[law.id].success ? (
                    <span>✅ +{syncResults[law.id].stats?.added || 0} añadidos, 🔄{syncResults[law.id].stats?.updated || 0} actualizados</span>
                  ) : (
                    <span>❌ {syncResults[law.id].error}</span>
                  )}
                </div>
              )}
              <button
                onClick={() => goToVerifyArticles(law.id)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-md text-sm transition-colors"
              >
                📋 Verificar artículos
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredLaws.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {!lawFilter.trim() && statusFilter === 'all'
            ? 'No hay leyes configuradas para monitoreo'
            : statusFilter !== 'all' && !lawFilter.trim()
              ? `No hay leyes con estado "${statusFilter === 'boe_diff' ? 'BOE ≠ BD' : statusFilter === 'problems' ? 'Problemas' : statusFilter}"`
              : `No se encontraron leyes con "${lawFilter}"${statusFilter !== 'all' ? ` y estado "${statusFilter}"` : ''}`}
        </div>
      )}

      {/* Modal informativo */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                ℹ️ ¿Cómo funciona el monitoreo?
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">🔍 Detectar cambios BOE</h4>
                <p>Descarga cada ley del BOE y comprueba si la fecha de "Última actualización" ha cambiado. <strong>NO compara artículos</strong>, solo detecta si el BOE ha publicado modificaciones.</p>
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">📋 Verificar artículos</h4>
                <p>Compara artículo por artículo el contenido del BOE con tu base de datos. Detecta títulos diferentes, contenido modificado y artículos faltantes.</p>
              </div>

              <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">🔄 Sincronizar BOE</h4>
                <p>Copia todos los artículos del BOE a tu base de datos. Añade los nuevos, actualiza los modificados y desactiva los eliminados.</p>
              </div>

              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">📊 Estados</h4>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li><span className="text-yellow-600">Cambio BOE</span>: El BOE actualizó esta ley</li>
                  <li><span className="text-orange-600">BOE ≠ BD</span>: Hay diferencias entre BOE y tu BD</li>
                  <li><span className="text-green-600">OK</span>: Todo sincronizado correctamente</li>
                  <li><span className="text-gray-500">Sin verificar</span>: No se han comparado artículos</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}