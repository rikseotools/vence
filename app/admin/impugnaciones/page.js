// app/admin/impugnaciones/page.js - Gestión de impugnaciones de preguntas
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export default function ImpugnacionesPage() {
  const { supabase } = useAuth()
  const [impugnaciones, setImpugnaciones] = useState([])
  const [psychometricDisputes, setPsychometricDisputes] = useState([])
  const [premiumUsers, setPremiumUsers] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('pendientes')
  const [typeFilter, setTypeFilter] = useState('todas') // 'todas', 'normales', 'psicotecnicas', 'ia'
  const [groupByUser, setGroupByUser] = useState(true) // Agrupar por usuario por defecto
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

      // Impugnaciones normales cargadas
      const normalDisputes = (disputes || []).map(d => ({ ...d, isPsychometric: false }))
      setImpugnaciones(normalDisputes)

      // Cargar impugnaciones psicotécnicas
      const supabaseServiceRole = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
      )

      const { data: psychoDisputes } = await supabaseServiceRole
        .from('psychometric_question_disputes')
        .select(`
          id,
          question_id,
          user_id,
          dispute_type,
          description,
          status,
          created_at,
          admin_response,
          source,
          ai_chat_log_id
        `)
        .order('created_at', { ascending: false })

      // Obtener info de usuarios y preguntas para psicotécnicas
      if (psychoDisputes && psychoDisputes.length > 0) {
        const psychoUserIds = [...new Set(psychoDisputes.map(d => d.user_id).filter(Boolean))]
        const psychoQuestionIds = [...new Set(psychoDisputes.map(d => d.question_id).filter(Boolean))]

        // Obtener perfiles de usuarios
        const { data: userProfiles } = await supabaseServiceRole
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', psychoUserIds)

        // Obtener preguntas psicotécnicas
        const { data: questions } = await supabaseServiceRole
          .from('psychometric_questions')
          .select('id, question_text, question_subtype')
          .in('id', psychoQuestionIds)

        const userMap = new Map((userProfiles || []).map(u => [u.id, u]))
        const questionMap = new Map((questions || []).map(q => [q.id, q]))

        const enrichedPsychoDisputes = psychoDisputes.map(d => ({
          ...d,
          isPsychometric: true,
          user_full_name: userMap.get(d.user_id)?.full_name || null,
          user_email: userMap.get(d.user_id)?.email || null,
          question_text: questionMap.get(d.question_id)?.question_text || null,
          question_subtype: questionMap.get(d.question_id)?.question_subtype || null
        }))

        setPsychometricDisputes(enrichedPsychoDisputes)
      }

      // Cargar usuarios premium
      const allDisputes = [...(disputes || []), ...(psychoDisputes || [])]
      if (allDisputes.length > 0) {
        const userIds = [...new Set(allDisputes.map(d => d.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: premiumData } = await supabaseServiceRole
            .from('user_profiles')
            .select('id, plan_type')
            .in('id', userIds)
            .in('plan_type', ['premium', 'trial'])

          if (premiumData) {
            setPremiumUsers(new Set(premiumData.map(p => p.id)))
          }
        }
      }

    } catch (err) {
      console.error('❌ Error cargando impugnaciones:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const closeDispute = async (disputeId, isPsychometric = false) => {
    if (!supabase) return

    try {
      console.log('🔒 Cerrando impugnación:', disputeId, isPsychometric ? '(psicotécnica)' : '(normal)')

      const tableName = isPsychometric ? 'psychometric_question_disputes' : 'question_disputes'

      const supabaseServiceRole = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
      )

      const { error } = await supabaseServiceRole
        .from(tableName)
        .update({
          status: 'rejected',
          resolved_at: new Date().toISOString(),
          admin_response: 'Impugnación cerrada por el administrador sin respuesta específica.',
          updated_at: new Date().toISOString()
        })
        .eq('id', disputeId)

      if (error) throw error

      console.log('✅ Impugnación cerrada exitosamente')

      // Email se envía automáticamente por trigger PostgreSQL
      // (send_dispute_email_notification) al hacer UPDATE de question_disputes

      // Recargar la lista
      await loadImpugnaciones()

    } catch (err) {
      console.error('❌ Error cerrando impugnación:', err)
      alert('Error al cerrar la impugnación: ' + err.message)
    }
  }

  const getFilteredImpugnaciones = () => {
    // Combinar todas las impugnaciones
    let allDisputes = [...impugnaciones, ...psychometricDisputes]

    // Filtrar por tipo
    if (typeFilter === 'normales') {
      allDisputes = allDisputes.filter(d => !d.isPsychometric)
    } else if (typeFilter === 'psicotecnicas') {
      allDisputes = allDisputes.filter(d => d.isPsychometric)
    } else if (typeFilter === 'ia') {
      allDisputes = allDisputes.filter(d => d.source === 'ai_auto')
    }

    // Ordenar por fecha
    allDisputes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Filtrar por estado
    switch (filter) {
      case 'pendientes':
        return allDisputes.filter(d => d.status === 'pending' || d.status === 'appealed')
      case 'resueltas':
        return allDisputes.filter(d => d.status === 'resolved')
      case 'rechazadas':
        return allDisputes.filter(d => d.status === 'rejected')
      default:
        return allDisputes
    }
  }

  // Agrupar impugnaciones por usuario
  const getGroupedByUser = (disputes) => {
    const groups = {}
    disputes.forEach(dispute => {
      const key = dispute.user_id || 'unknown'
      if (!groups[key]) {
        groups[key] = {
          userId: dispute.user_id,
          userName: dispute.user_full_name || dispute.user_email || 'Usuario desconocido',
          userEmail: dispute.user_email,
          isPremium: premiumUsers.has(dispute.user_id),
          disputes: []
        }
      }
      groups[key].disputes.push(dispute)
    })
    // Ordenar grupos por cantidad de impugnaciones (más primero)
    return Object.values(groups).sort((a, b) => b.disputes.length - a.disputes.length)
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
  const allDisputes = [...impugnaciones, ...psychometricDisputes]
  const pendingCount = allDisputes.filter(d => d.status === 'pending' || d.status === 'appealed').length
  const resolvedCount = allDisputes.filter(d => d.status === 'resolved').length
  const rejectedCount = allDisputes.filter(d => d.status === 'rejected').length
  const appealedCount = allDisputes.filter(d => d.status === 'appealed').length
  const psychoCount = psychometricDisputes.length

  // Stats de precisión de la IA
  const aiDisputes = allDisputes.filter(d => d.source === 'ai_auto')
  const aiResolved = aiDisputes.filter(d => d.status === 'resolved').length
  const aiRejected = aiDisputes.filter(d => d.status === 'rejected').length
  const aiProcessed = aiResolved + aiRejected
  const aiAccuracy = aiProcessed > 0 ? Math.round((aiResolved / aiProcessed) * 100) : null

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
            href="/admin" 
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm text-center w-full sm:w-auto"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-600">{allDisputes.length}</p>
            </div>
            <span className="text-2xl sm:text-3xl">📋</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 hidden sm:block">{impugnaciones.length} normales + {psychoCount} psico</p>
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
          <p className="text-xs text-gray-500 mt-2 hidden sm:block">No procedentes + Cerradas</p>
        </div>

        <div className={`rounded-lg shadow p-3 sm:p-6 border ${
          aiAccuracy !== null && aiAccuracy >= 70
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : aiAccuracy !== null
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              : 'bg-white dark:bg-gray-800'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">IA Auto</p>
              <p className="text-lg sm:text-2xl font-bold text-indigo-600">{aiDisputes.length}</p>
            </div>
            <span className="text-2xl sm:text-3xl">🤖</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 hidden sm:block">
            {aiAccuracy !== null
              ? `Precisión: ${aiAccuracy}% (${aiResolved}/${aiProcessed})`
              : `${aiDisputes.length - aiProcessed} sin procesar`
            }
          </p>
        </div>
      </div>

      {/* Barra de precisión IA */}
      {aiProcessed > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              🤖 Precisión de la IA en detección de errores
            </h3>
            <span className={`text-sm font-bold ${aiAccuracy >= 70 ? 'text-emerald-600' : 'text-orange-600'}`}>
              {aiAccuracy}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${aiAccuracy >= 70 ? 'bg-emerald-500' : 'bg-orange-500'}`}
              style={{ width: `${aiAccuracy}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Aceptadas (IA acertó): {aiResolved}</span>
            <span>Rechazadas (IA erró): {aiRejected}</span>
            <span>Pendientes: {aiDisputes.length - aiProcessed}</span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-3 sm:p-4 space-y-3">
        {/* Filtro por tipo */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo:</span>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'todas', label: 'Todas', count: allDisputes.length },
              { key: 'normales', label: 'Normales', icon: '📚', count: impugnaciones.length },
              { key: 'psicotecnicas', label: 'Psicotécnicas', icon: '🧠', count: psychoCount },
              { key: 'ia', label: 'Auto IA', icon: '🤖', count: aiDisputes.length }
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                  typeFilter === opt.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {opt.icon && <span className="mr-1">{opt.icon}</span>}
                {opt.label} ({opt.count})
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por estado */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado:</span>
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

        {/* Toggle agrupar por usuario */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vista:</span>
          <button
            onClick={() => setGroupByUser(!groupByUser)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              groupByUser
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <span>👥</span>
            <span>Agrupar por usuario</span>
          </button>
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
        ) : groupByUser ? (
          // Vista agrupada por usuario
          getGroupedByUser(filteredImpugnaciones).map((group) => (
            <UserDisputeGroup
              key={group.userId || 'unknown'}
              group={group}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              getCorrectOptionLetter={getCorrectOptionLetter}
              onCloseDispute={closeDispute}
              supabase={supabase}
            />
          ))
        ) : (
          // Vista lista plana
          filteredImpugnaciones.map((dispute, index) => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              index={index}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              getCorrectOptionLetter={getCorrectOptionLetter}
              onCloseDispute={closeDispute}
              supabase={supabase}
              isPremium={premiumUsers.has(dispute.user_id)}
            />
          ))
        )}
      </div>

    </div>
  )
}

// Componente separado para cada tarjeta de impugnación (solo lectura)
function DisputeCard({ dispute, index, getStatusBadge, getPriorityBadge, getCorrectOptionLetter, onCloseDispute, supabase, isPremium, compact = false }) {
  const [showFullQuestion, setShowFullQuestion] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const handleClose = async () => {
    if (!confirm('¿Estás seguro de que quieres rechazar esta impugnación? Se marcará como no procedente sin respuesta específica.')) {
      return
    }

    setIsClosing(true)
    try {
      await onCloseDispute(dispute.id, dispute.isPsychometric)
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-3 sm:p-6">
      {/* Header de la impugnación */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start space-x-3">
            <span className="text-base sm:text-lg font-bold text-gray-600 flex-shrink-0">#{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {dispute.source === 'ai_auto' && (
                  <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-1 rounded-full text-xs font-medium">
                    🤖 Auto IA
                  </span>
                )}
                {dispute.isPsychometric && (
                  <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-full text-xs font-medium">
                    🧠 Psicotécnica
                  </span>
                )}
                {getStatusBadge(dispute.status)}
                {!dispute.isPsychometric && getPriorityBadge(dispute.priority)}
              </div>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded truncate">
                    🏷️ ID: <strong className="font-mono">{dispute.id.slice(0, 8)}...</strong>
                  </span>
                  <span className="bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded truncate">
                    ❓ Pregunta: <strong className="font-mono">{dispute.question_id?.slice(0, 8) || 'N/A'}...</strong>
                  </span>
                  {dispute.ai_chat_log_id && (
                    <span className="bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded truncate">
                      🤖 Chat log: <strong className="font-mono">{dispute.ai_chat_log_id.slice(0, 8)}...</strong>
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    {!compact && (
                      <span className="flex items-center gap-1">
                        👤 <strong className="text-blue-600 dark:text-blue-400 truncate">{dispute.user_full_name || dispute.user_email || 'Usuario desconocido'}</strong>
                        {isPremium && (
                          <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm">
                            Premium
                          </span>
                        )}
                      </span>
                    )}
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
          
          {/* Botón de cerrar - solo para impugnaciones pendientes o con alegación */}
          {(dispute.status === 'pending' || dispute.status === 'appealed') && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleClose}
                disabled={isClosing}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                {isClosing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Cerrando...
                  </>
                ) : (
                  <>
                    ❌ Rechazar
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                (Sin respuesta)
              </p>
            </div>
          )}
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

// Componente para agrupar impugnaciones por usuario
function UserDisputeGroup({ group, getStatusBadge, getPriorityBadge, getCorrectOptionLetter, onCloseDispute, supabase }) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border overflow-hidden">
      {/* Header del grupo - Usuario */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-b border-indigo-100 dark:border-indigo-800 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/50 dark:hover:to-purple-900/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <span className="text-lg">👤</span>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {group.userName}
                </span>
                {group.isPremium && (
                  <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm">
                    Premium
                  </span>
                )}
              </div>
              {group.userEmail && group.userEmail !== group.userName && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{group.userEmail}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-sm font-medium">
              {group.disputes.length} impugnacion{group.disputes.length !== 1 ? 'es' : ''}
            </span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Lista de impugnaciones del usuario */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-900/30">
          {group.disputes.map((dispute, index) => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              index={index}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              getCorrectOptionLetter={getCorrectOptionLetter}
              onCloseDispute={onCloseDispute}
              supabase={supabase}
              isPremium={group.isPremium}
              compact={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}