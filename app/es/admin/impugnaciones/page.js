// app/es/admin/impugnaciones/page.js - Gestión de impugnaciones de preguntas
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import Link from 'next/link'

export default function ImpugnacionesPage() {
  const { supabase } = useAuth()
  const [impugnaciones, setImpugnaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('pendientes') // Cambiado: Por defecto mostrar pendientes
  useEffect(() => {
    loadImpugnaciones()
  }, [supabase])

  const loadImpugnaciones = async () => {
    if (!supabase) return

    try {
      setLoading(true)
      console.log('📋 Cargando impugnaciones...')

      // Cargar todas las impugnaciones con información de usuario y pregunta
      // Usar RPC para hacer el JOIN manualmente
      const { data: disputes, error: disputesError } = await supabase.rpc('get_disputes_with_users_debug')

      if (disputesError) throw disputesError

      // Impugnaciones cargadas correctamente
      setImpugnaciones(disputes || [])

    } catch (err) {
      console.error('❌ Error cargando impugnaciones:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredImpugnaciones = () => {
    switch (filter) {
      case 'pendientes':
        return impugnaciones.filter(d => d.status === 'pending' || d.status === 'appealed')
      case 'resueltas':
        return impugnaciones.filter(d => d.status === 'resolved')
      case 'rechazadas':
        return impugnaciones.filter(d => d.status === 'rejected')
      default:
        return impugnaciones
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">⏳ Pendiente</span>
      case 'resolved':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">✅ Resuelta</span>
      case 'rejected':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">❌ Rechazada</span>
      case 'appealed':
        return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">📝 Con Alegación</span>
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">❓ {status}</span>
    }
  }

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">🚨 Alta</span>
      case 'medium':
        return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">⚠️ Media</span>
      case 'low':
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">📝 Baja</span>
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">❓ {priority}</span>
    }
  }

  const getCorrectOptionLetter = (correctOption) => {
    switch (correctOption) {
      case 'A': return 'A'
      case 'B': return 'B' 
      case 'C': return 'C'
      case 'D': return 'D'
      default: return correctOption
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">📋 Cargando impugnaciones...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Error cargando impugnaciones</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          🔄 Reintentar
        </button>
      </div>
    )
  }

  const filteredImpugnaciones = getFilteredImpugnaciones()
  const pendingCount = impugnaciones.filter(d => d.status === 'pending' || d.status === 'appealed').length
  const resolvedCount = impugnaciones.filter(d => d.status === 'resolved').length
  const rejectedCount = impugnaciones.filter(d => d.status === 'rejected').length
  const appealedCount = impugnaciones.filter(d => d.status === 'appealed').length

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            📋 Gestión de Impugnaciones
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            Administrar impugnaciones de preguntas enviadas por usuarios
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button 
            onClick={loadImpugnaciones}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm w-full sm:w-auto"
          >
            🔄 Actualizar
          </button>
          <Link
            href="/es/admin" 
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm text-center w-full sm:w-auto"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-600">{impugnaciones.length}</p>
            </div>
            <span className="text-2xl sm:text-3xl">📋</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 hidden sm:block">Impugnaciones totales</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Pendientes</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
            <span className="text-2xl sm:text-3xl">⏳</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 hidden sm:block">Requieren atención</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Resueltas</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{resolvedCount}</p>
            </div>
            <span className="text-2xl sm:text-3xl">✅</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 hidden sm:block">Completadas exitosamente</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Rechazadas</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600">{rejectedCount}</p>
            </div>
            <span className="text-2xl sm:text-3xl">❌</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 hidden sm:block">No procedentes</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar:</span>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {[
              { key: 'todas', label: 'Todas', icon: '📋' },
              { key: 'pendientes', label: 'Pendientes', icon: '⏳' },
              { key: 'resueltas', label: 'Resueltas', icon: '✅' },
              { key: 'rechazadas', label: 'Rechazadas', icon: '❌' }
            ].map(filterOption => (
              <button
                key={filterOption.key}
                onClick={() => setFilter(filterOption.key)}
                className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                  filter === filterOption.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="block sm:inline">{filterOption.icon}</span>
                <span className="block sm:inline sm:ml-1">{filterOption.label}</span> 
                {filterOption.key !== 'todas' && (
                  <span className="block sm:inline sm:ml-1 text-xs">
                    ({filterOption.key === 'pendientes' ? pendingCount : 
                      filterOption.key === 'resueltas' ? resolvedCount : rejectedCount})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de impugnaciones */}
      <div className="space-y-4">
        {filteredImpugnaciones.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 sm:p-8 text-center">
            <div className="text-4xl sm:text-6xl mb-4">📭</div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay impugnaciones {filter !== 'todas' ? filter : ''}
            </h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {filter === 'pendientes' 
                ? 'Todas las impugnaciones han sido procesadas' 
                : filter === 'resueltas' 
                ? 'No hay impugnaciones resueltas todavía'
                : filter === 'rechazadas'
                ? 'No hay impugnaciones rechazadas todavía'
                : 'No se han recibido impugnaciones todavía'}
            </p>
          </div>
        ) : (
          filteredImpugnaciones.map((dispute, index) => (
            <DisputeCard 
              key={dispute.id} 
              dispute={dispute} 
              index={index}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              getCorrectOptionLetter={getCorrectOptionLetter}
            />
          ))
        )}
      </div>

    </div>
  )
}

// Componente separado para cada tarjeta de impugnación (solo lectura)
function DisputeCard({ dispute, index, getStatusBadge, getPriorityBadge, getCorrectOptionLetter }) {
  const [showFullQuestion, setShowFullQuestion] = useState(false)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-3 sm:p-6">
      {/* Header de la impugnación */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start space-x-3">
            <span className="text-base sm:text-lg font-bold text-gray-600 flex-shrink-0">#{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {getStatusBadge(dispute.status)}
                {getPriorityBadge(dispute.priority)}
              </div>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded truncate">
                    🏷️ ID: <strong className="font-mono">{dispute.id.slice(0, 8)}...</strong>
                  </span>
                  <span className="bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded truncate">
                    ❓ Pregunta: <strong className="font-mono">{dispute.question_id.slice(0, 8)}...</strong>
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="flex items-center gap-1">
                      👤 <strong className="text-blue-600 dark:text-blue-400 truncate">{dispute.user_full_name || dispute.user_email || 'Usuario desconocido'}</strong>
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(dispute.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido de la impugnación */}
      <div className="flex flex-col gap-4 sm:gap-6">
        
        {/* Impugnación del usuario */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">📝 Impugnación del Usuario</h4>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="text-sm text-yellow-900 dark:text-yellow-200">
              <strong>Categoría:</strong> {dispute.category || 'Sin categoría'}
            </div>
            <div className="text-sm text-yellow-900 dark:text-yellow-200 mt-2">
              <strong>Descripción:</strong>
            </div>
            <div className="text-sm text-yellow-800 dark:text-yellow-300 mt-1 bg-white dark:bg-gray-800 p-2 rounded border">
              {dispute.description || 'Sin descripción'}
            </div>
            {dispute.evidence && (
              <div className="mt-2">
                <div className="text-sm text-yellow-900 dark:text-yellow-200">
                  <strong>Evidencia/Justificación:</strong>
                </div>
                <div className="text-sm text-yellow-800 dark:text-yellow-300 mt-1 bg-white dark:bg-gray-800 p-2 rounded border">
                  {dispute.evidence}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pregunta impugnada */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">❓ Pregunta Impugnada</h4>
            <button
              onClick={() => setShowFullQuestion(!showFullQuestion)}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              {showFullQuestion ? 'Ocultar detalles' : 'Ver detalles'}
            </button>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border">
            <div className="text-sm text-gray-900 dark:text-white font-medium mb-2">
              {showFullQuestion 
                ? dispute.question_text
                : `${dispute.question_text?.substring(0, 100)}${dispute.question_text?.length > 100 ? '...' : ''}`
              }
            </div>
            
            {showFullQuestion && dispute.question_text && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                <p>📋 Detalles completos de la pregunta disponibles en el sistema de preguntas</p>
                <p className="text-xs mt-1">ID: {dispute.question_id}</p>
              </div>
            )}
          </div>
        </div>

        {/* Alegación del usuario (si existe) */}
        {dispute.status === 'appealed' && dispute.appeal_text && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-200">📝 Alegación del Usuario</h4>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
              <div className="text-sm text-orange-800 dark:text-orange-200 mb-2">
                <strong>Enviada:</strong> {dispute.appeal_submitted_at ? new Date(dispute.appeal_submitted_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Fecha no disponible'}
              </div>
              <div className="text-sm text-orange-900 dark:text-orange-100 leading-relaxed">
                {dispute.appeal_text}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notas del admin (si existen) */}
      {dispute.admin_notes && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
            📝 Notas del Administrador
            {dispute.reviewed_at && (
              <span className="ml-2 font-normal text-green-700 dark:text-green-300">
                • Revisado el {new Date(dispute.reviewed_at).toLocaleDateString('es-ES')}
              </span>
            )}
          </div>
          <div className="text-sm text-green-800 dark:text-green-300">
            {dispute.admin_notes}
          </div>
        </div>
      )}
    </div>
  )
}