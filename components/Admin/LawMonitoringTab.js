// components/admin/LawMonitoringTab.js
'use client'

import { useState, useEffect } from 'react'

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
  const [laws, setLaws] = useState([])
  const [loading, setLoading] = useState(false)
  const [processingLaws, setProcessingLaws] = useState(new Set()) // IDs de leyes siendo procesadas
  const [completedLaws, setCompletedLaws] = useState(new Set()) // IDs de leyes completadas
  const [lastCheck, setLastCheck] = useState(null)
  const [error, setError] = useState(null)

  const checkLawChanges = async () => {
    try {
      setLoading(true)
      setError(null)
      setProcessingLaws(new Set())
      setCompletedLaws(new Set())
      
      // Primero obtener lista de leyes
      const initialResponse = await fetch('/api/law-changes')
      const initialData = await initialResponse.json()
      
      if (!initialData.success) {
        setError(initialData.error || 'Error obteniendo lista de leyes')
        return
      }
      
      // Mostrar leyes iniciales
      setLaws(initialData.results)
      
      // Verificar cada ley individualmente para mostrar progreso
      const lawsToCheck = initialData.results
      
      for (const law of lawsToCheck) {
        try {
          // Marcar ley como procesándose
          setProcessingLaws(prev => new Set([...prev, law.id]))
          
          // Verificar ley específica
          const response = await fetch(`/api/law-changes?law=${encodeURIComponent(law.law)}`)
          const data = await response.json()
          
          if (data.success && data.results.length > 0) {
            const updatedLaw = data.results[0]
            
            // Actualizar solo esta ley en el estado
            setLaws(prev => prev.map(l => 
              l.id === law.id ? updatedLaw : l
            ))
          }
          
          // Pequeña pausa entre verificaciones
          await new Promise(resolve => setTimeout(resolve, 500))
          
        } catch (err) {
          console.error(`Error verificando ${law.law}:`, err)
        } finally {
          // Remover ley de procesándose y marcar como completada
          setProcessingLaws(prev => {
            const newSet = new Set(prev)
            newSet.delete(law.id)
            return newSet
          })
          setCompletedLaws(prev => new Set([...prev, law.id]))
        }
      }
      
      setLastCheck(new Date().toISOString())
      
    } catch (err) {
      setError('Error conectando con el servidor')
    } finally {
      setLoading(false)
      setProcessingLaws(new Set())
      setCompletedLaws(new Set())
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
  }, [])

  const hasUnreviewedChanges = laws.some(law => law.changeStatus === 'changed')

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
        
        <button
          onClick={checkLawChanges}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors text-sm sm:text-base w-full sm:w-auto flex items-center space-x-2"
        >
          {loading && <Spinner size="sm" />}
          <span>{loading ? 'Verificando...' : 'Verificar ahora'}</span>
        </button>
      </div>

      {/* Barra de progreso global */}
      {loading && sortedLaws.length > 0 && (
        <div className="mb-6">
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progreso de verificación
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {completedLaws.size} / {sortedLaws.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${sortedLaws.length > 0 ? (completedLaws.size / sortedLaws.length) * 100 : 0}%` 
                }}
              ></div>
            </div>
            {processingLaws.size > 0 && (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Verificando: {[...processingLaws].map(id => 
                  sortedLaws.find(l => l.id === id)?.law
                ).filter(Boolean).join(', ')}
              </div>
            )}
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
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedLaws.map((law) => (
              <tr 
                key={law.id}
                className={law.changeStatus === 'changed' ? 'bg-red-50 dark:bg-red-900/20' : ''}
              >
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {law.law}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {law.name}
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  {processingLaws.has(law.id) ? (
                    <div className="flex items-center space-x-2">
                      <Spinner size="sm" />
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        Verificando...
                      </span>
                    </div>
                  ) : law.status === 'error' ? (
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
                  {law.changeStatus === 'changed' && (
                    <button
                      onClick={() => markAsReviewed(law.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition-colors"
                    >
                      Marcar como revisado
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {sortedLaws.map((law) => (
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {law.law}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {law.name}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="mb-3">
              {processingLaws.has(law.id) ? (
                <div className="flex items-center space-x-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Spinner size="sm" />
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    Verificando en BOE...
                  </span>
                </div>
              ) : law.status === 'error' ? (
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
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              📋 Último cambio BOE: {law.lastUpdateBOE ? law.lastUpdateBOE : 'Sin fecha'}
            </div>

            {/* Action */}
            {law.changeStatus === 'changed' && (
              <button
                onClick={() => markAsReviewed(law.id)}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm transition-colors"
              >
                Marcar como revisado
              </button>
            )}
          </div>
        ))}
      </div>

      {sortedLaws.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No hay leyes configuradas para monitoreo
        </div>
      )}
    </div>
  )
}