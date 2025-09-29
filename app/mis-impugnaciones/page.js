// app/mis-impugnaciones/page.js - CORREGIDO SIN reviewed_at
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/AuthContext'

const DEBUG = process.env.NODE_ENV === 'development'

export default function MisImpugnacionesPage() {
  const { user, loading: authLoading, supabase } = useAuth()
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    rejected: 0
  })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    
    loadUserDisputes()
  }, [user, authLoading, supabase])

  async function loadUserDisputes() {
    try {
      if (DEBUG) {
        console.log('🔍 DEBUG: Iniciando carga de impugnaciones')
        console.log('🔍 DEBUG: Usuario actual:', user)
        console.log('🔍 DEBUG: User ID:', user?.id)
        console.log('🔍 DEBUG: User email:', user?.email)
      }

      // ✅ QUERY CORREGIDA: SIN reviewed_at que no existe
      const { data: disputes, error } = await supabase
        .from('question_disputes')
        .select(`
          id,
          dispute_type,
          description,
          status,
          created_at,
          resolved_at,
          admin_response,
          appeal_text,
          appeal_submitted_at,
          questions!inner (
            question_text,
            correct_option,
            option_a,
            option_b,
            option_c,
            option_d,
            articles!inner (
              article_number,
              title,
              laws!inner (short_name)
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (DEBUG) {
        console.log('🔍 DEBUG: Query ejecutada con user_id:', user.id)
        console.log('🔍 DEBUG: Error:', error)
        console.log('🔍 DEBUG: Disputes encontradas:', disputes)
        console.log('🔍 DEBUG: Número de disputes:', disputes?.length)
        
      }

      if (error) throw error
      
      setDisputes(disputes || [])
      
      // Calcular estadísticas
      const stats = {
        total: disputes?.length || 0,
        pending: disputes?.filter(d => d.status === 'pending').length || 0,
        resolved: disputes?.filter(d => d.status === 'resolved').length || 0,
        rejected: disputes?.filter(d => d.status === 'rejected').length || 0,
        appealed: disputes?.filter(d => d.status === 'appealed').length || 0
      }
      setStats(stats)

      if (DEBUG) {
        console.log('🔍 DEBUG: Estadísticas calculadas:', stats)
      }
      
    } catch (error) {
      console.error('❌ Error cargando impugnaciones:', error)
      if (DEBUG) {
        console.error('❌ DEBUG: Error completo:', error)
        console.error('❌ DEBUG: Stack trace:', error.stack)
      }
    } finally {
      setLoading(false)
    }
  }


  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: '🟡 Pendiente', color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300' },
      reviewing: { text: '🔵 En revisión', color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' },
      resolved: { text: '🟢 Resuelta', color: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' },
      rejected: { text: '🔴 Rechazada', color: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' },
      appealed: { text: '📝 Con Alegación', color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300' }
    }
    return badges[status] || { text: status, color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300' }
  }

  const getDisputeTypeText = (type) => {
    const types = {
      'respuesta_incorrecta': '❌ Respuesta Incorrecta',
      'no_literal': '📝 No Literal',
      'otro': '❓ Otro Motivo'
    }
    return types[type] || type
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando impugnaciones...</p>
          {DEBUG && (
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              <p>DEBUG: authLoading={authLoading?.toString()}</p>
              <p>DEBUG: loading={loading?.toString()}</p>
              <p>DEBUG: user={user?.email || 'null'}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Acceso Requerido
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Para ver tus impugnaciones necesitas estar registrado.
          </p>
          <Link 
            href="/login"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-bold hover:opacity-90 transition-opacity block"
          >
            🚀 Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                🛡️ Mis Impugnaciones
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Historial de reportes de preguntas incorrectas
              </p>
            </div>
            <Link 
              href="/perfil"
              className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              ← Volver al Perfil
            </Link>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Pendientes</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Resueltas</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Rechazadas</div>
            </div>
          </div>
        </div>

        {/* Lista de impugnaciones */}
        {disputes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              No tienes impugnaciones
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Cuando encuentres una pregunta incorrecta, puedes reportarla desde el test.
            </p>
            <Link 
              href="/auxiliar-administrativo-estado/test"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
            >
              🎯 Hacer un Test
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {disputes.map((dispute) => {
              const statusBadge = getStatusBadge(dispute.status)
              return (
                <div key={dispute.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  
                  {/* Header de la impugnación */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge.color}`}>
                          {statusBadge.text}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {dispute.questions?.articles?.laws?.short_name} - Art. {dispute.questions?.articles?.article_number}
                        </span>
                        <span className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                          {getDisputeTypeText(dispute.dispute_type)}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      📅 {new Date(dispute.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>

                  {/* Pregunta impugnada */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📋 Pregunta impugnada:</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <p className="text-gray-700 dark:text-gray-300 mb-3">{dispute.questions?.question_text}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <div>A) {dispute.questions?.option_a}</div>
                        <div>B) {dispute.questions?.option_b}</div>
                        <div>C) {dispute.questions?.option_c}</div>
                        <div>D) {dispute.questions?.option_d}</div>
                      </div>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 font-medium">
                        Respuesta marcada como correcta: {['A', 'B', 'C', 'D'][dispute.questions?.correct_option - 1]}
                      </p>
                    </div>
                  </div>

                  {/* Tu reporte */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">💬 Tu reporte:</h4>
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border-l-4 border-blue-400">
                      <p className="text-blue-800 dark:text-blue-300">{dispute.description}</p>
                    </div>
                  </div>

                  {/* Respuesta del administrador */}
                  {dispute.admin_response && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">👨‍💼 Respuesta del administrador:</h4>
                      <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border-l-4 border-green-400">
                        <p className="text-green-800 dark:text-green-300">{dispute.admin_response}</p>
                        {dispute.resolved_at && (
                          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                            ✅ Resuelto el {new Date(dispute.resolved_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mostrar alegación enviada si existe */}
                  {dispute.status === 'appealed' && dispute.appeal_text && (
                    <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                      <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                        📝 Tu Alegación (Enviada)
                      </h4>
                      <div className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                        <strong>Enviada:</strong> {dispute.appeal_submitted_at ? new Date(dispute.appeal_submitted_at).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'long', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Fecha no disponible'}
                      </div>
                      <div className="text-sm text-orange-800 dark:text-orange-200 leading-relaxed">
                        {dispute.appeal_text}
                      </div>
                      <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-800/30 rounded text-xs text-orange-700 dark:text-orange-300">
                        ⏳ Tu alegación está siendo revisada por el equipo de administración.
                      </div>
                    </div>
                  )}

                  {/* Estado pendiente */}
                  {dispute.status === 'pending' && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg border-l-4 border-yellow-400">
                      <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                        ⏳ Tu impugnación está pendiente de revisión. Te notificaremos cuando sea procesada.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}