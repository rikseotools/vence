// app/admin/usuarios/[id]/page.js - Vista detallada de usuario individual con emails (sin envío manual)
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function UserDetailPage() {
  const { supabase } = useAuth()
  const params = useParams()
  const userId = params.id

  const [user, setUser] = useState(null)
  const [userStats, setUserStats] = useState(null)
  const [userTests, setUserTests] = useState([])
  const [userSessions, setUserSessions] = useState([])
  const [userEmails, setUserEmails] = useState([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    if (userId && supabase) {
      loadUserDetail()
    }
  }, [userId, supabase])

  async function loadUserDetail() {
    if (!supabase || !userId) return

    try {
      setLoading(true)
      console.log('👤 Cargando detalles del usuario:', userId)

      // 1. Información básica del usuario con roles
      const { data: userData, error: userError } = await supabase
        .from('admin_users_with_roles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (userError) throw userError

      // 2. Tests del usuario
      const { data: testsData, error: testsError } = await supabase
        .from('tests')
        .select(`
          id,
          title,
          total_questions,
          score,
          is_completed,
          started_at,
          completed_at,
          tema_number,
          test_type
        `)
        .eq('user_id', userId)
        .order('started_at', { ascending: false })

      if (testsError) throw testsError

      // 3. Sesiones del usuario (últimas 10)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('user_sessions')
        .select(`
          session_start,
          session_end,
          total_duration_minutes,
          device_model,
          browser_name,
          tests_completed,
          questions_answered
        `)
        .eq('user_id', userId)
        .order('session_start', { ascending: false })
        .limit(10)

      if (sessionsError) throw sessionsError

      // 4. Estadísticas detalladas de respuestas
      const { data: questionsData, error: questionsError } = await supabase
        .from('test_questions')
        .select(`
          article_number,
          law_name,
          is_correct,
          time_spent_seconds,
          confidence_level,
          created_at,
          tests!inner(user_id)
        `)
        .eq('tests.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (questionsError) throw questionsError

      // 5. Emails del usuario
      const { data: emailsData, error: emailsError } = await supabase
        .from('email_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10) // Limitar a 10 más recientes para rendimiento

      if (emailsError) {
        console.error('❌ Error cargando emails del usuario:', emailsError)
      }

      // 6. Procesar estadísticas
      const stats = calculateUserStats(testsData, sessionsData, questionsData)

      setUser(userData)
      setUserTests(testsData)
      setUserSessions(sessionsData)
      setUserEmails(emailsData || [])
      setUserStats(stats)

      console.log('✅ Detalles del usuario cargados')

    } catch (err) {
      console.error('❌ Error cargando detalles del usuario:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadUserEmails() {
    setEmailLoading(true)
    try {
      const { data: emailsData, error: emailsError } = await supabase
        .from('email_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (emailsError) {
        console.error('❌ Error recargando emails:', emailsError)
      }
      setUserEmails(emailsData || [])
    } catch (err) {
      console.error('❌ Excepción cargando emails:', err)
    } finally {
      setEmailLoading(false)
    }
  }

  async function handleDeleteUser() {
    if (deleteConfirmText !== 'ELIMINAR') {
      alert('Debes escribir ELIMINAR para confirmar')
      return
    }

    setDeleteLoading(true)
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      })

      const result = await response.json()

      if (result.success) {
        alert('Usuario eliminado correctamente')
        window.location.href = '/admin/usuarios'
      } else {
        alert(`Error eliminando usuario: ${result.error}`)
      }
    } catch (err) {
      console.error('Error eliminando usuario:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  function calculateUserStats(tests, sessions, questions) {
    const completedTests = tests.filter(t => t.is_completed)
    const abandonedTests = tests.filter(t => !t.is_completed)

    // Estadísticas básicas
    const totalTests = tests.length
    const completionRate = totalTests > 0 ? Math.round((completedTests.length / totalTests) * 100) : 0

    // Estadísticas de tiempo
    const totalStudyTime = sessions.reduce((sum, s) => sum + (s.total_duration_minutes || 0), 0)
    const avgSessionDuration = sessions.length > 0 ? Math.round(totalStudyTime / sessions.length) : 0

    // Estadísticas de preguntas
    const totalQuestions = questions.length
    const correctQuestions = questions.filter(q => q.is_correct).length
    const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0

    // Análisis por artículo
    const articleStats = {}
    questions.forEach(q => {
      const key = `${q.law_name || 'Sin ley'} - Art. ${q.article_number || 'Sin art'}`
      if (!articleStats[key]) {
        articleStats[key] = { total: 0, correct: 0, law: q.law_name, article: q.article_number }
      }
      articleStats[key].total++
      if (q.is_correct) articleStats[key].correct++
    })

    const articlePerformance = Object.entries(articleStats)
      .map(([key, stats]) => ({
        article: key,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        attempts: stats.total,
        law: stats.law,
        articleNumber: stats.article
      }))
      .sort((a, b) => a.accuracy - b.accuracy) // Peores primero

    // Análisis temporal
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentTests = tests.filter(t => new Date(t.started_at) > last7Days)
    const recentSessions = sessions.filter(s => new Date(s.session_start) > last7Days)

    // Patrones de confianza
    const confidenceStats = questions.reduce((acc, q) => {
      acc[q.confidence_level || 'unknown'] = (acc[q.confidence_level || 'unknown'] || 0) + 1
      return acc
    }, {})

    // Actividad por día de la semana
    const dayActivity = sessions.reduce((acc, session) => {
      const day = new Date(session.session_start).getDay()
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const dayName = dayNames[day]
      acc[dayName] = (acc[dayName] || 0) + 1
      return acc
    }, {})

    return {
      overview: {
        totalTests,
        completedTests: completedTests.length,
        abandonedTests: abandonedTests.length,
        completionRate,
        totalQuestions,
        correctQuestions,
        accuracy,
        totalStudyTime,
        avgSessionDuration
      },
      recent: {
        testsLast7Days: recentTests.length,
        sessionsLast7Days: recentSessions.length,
        studyTimeLast7Days: recentSessions.reduce((sum, s) => sum + (s.total_duration_minutes || 0), 0)
      },
      performance: {
        articlePerformance: articlePerformance.slice(0, 10), // Top 10 peores
        confidenceStats,
        dayActivity
      },
      lastActivity: sessions.length > 0 ? sessions[0].session_start : null
    }
  }

  function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  function getActivityStatus(user, stats) {
    if (!stats.lastActivity) return { status: 'Sin actividad', color: 'text-gray-500', bg: 'bg-gray-100' }
    
    const daysSince = Math.floor((Date.now() - new Date(stats.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSince === 0) return { status: 'Activo hoy', color: 'text-green-600', bg: 'bg-green-100' }
    if (daysSince === 1) return { status: 'Activo ayer', color: 'text-green-600', bg: 'bg-green-100' }
    if (daysSince <= 3) return { status: `Hace ${daysSince} días`, color: 'text-yellow-600', bg: 'bg-yellow-100' }
    if (daysSince <= 7) return { status: `Hace ${daysSince} días`, color: 'text-orange-600', bg: 'bg-orange-100' }
    return { status: `Hace ${daysSince} días`, color: 'text-red-600', bg: 'bg-red-100' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">👤 Cargando perfil de usuario...</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          Error cargando usuario
        </h3>
        <p className="text-red-600 dark:text-red-400">{error || 'Usuario no encontrado'}</p>
        <Link 
          href="/admin/usuarios"
          className="mt-4 inline-block bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          ← Volver a Usuarios
        </Link>
      </div>
    )
  }

  const activityStatus = getActivityStatus(user, userStats)

  return (
    <div className="space-y-6">
      
      {/* Header con información básica */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user.full_name || 'Sin nombre'}
                </h1>
                {user.active_roles?.includes('super_admin') && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                    👑 Super Admin
                  </span>
                )}
                {user.active_roles?.includes('admin') && !user.active_roles?.includes('super_admin') && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                    👨‍💼 Admin
                  </span>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-2 py-1 rounded-full text-sm ${activityStatus.bg} ${activityStatus.color}`}>
                  📅 {activityStatus.status}
                </span>
                <span className={`px-2 py-1 rounded-full text-sm ${
                  user.is_active_student 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {user.is_active_student ? '✅ Usuario Activo' : '❌ Usuario Inactivo'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {!user.is_active_student && (
              <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-200">
                <span className="text-orange-600 text-sm font-medium">
                  ⚡ Sistema automático activado
                </span>
              </div>
            )}
            <Link
              href={`/admin/usuarios/${userId}/emails`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              📧 Ver Emails
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              🗑️ Eliminar Usuario
            </button>
            <Link
              href="/admin/usuarios"
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Volver a Usuarios
            </Link>
          </div>
        </div>
      </div>

      {/* Estadísticas principales */}
      {userStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border text-center">
            <div className="text-2xl font-bold text-blue-600">{userStats.overview.totalTests}</div>
            <div className="text-sm text-gray-600">Tests Totales</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border text-center">
            <div className="text-2xl font-bold text-green-600">{userStats.overview.completedTests}</div>
            <div className="text-sm text-gray-600">Completados</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border text-center">
            <div className="text-2xl font-bold text-red-600">{userStats.overview.abandonedTests}</div>
            <div className="text-sm text-gray-600">Abandonados</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border text-center">
            <div className="text-2xl font-bold text-purple-600">{userStats.overview.completionRate}%</div>
            <div className="text-sm text-gray-600">Completion Rate</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border text-center">
            <div className="text-2xl font-bold text-yellow-600">{userStats.overview.accuracy}%</div>
            <div className="text-sm text-gray-600">Accuracy</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border text-center">
            <div className="text-2xl font-bold text-orange-600">{formatDuration(userStats.overview.totalStudyTime)}</div>
            <div className="text-sm text-gray-600">Tiempo Total</div>
          </div>
        </div>
      )}

      {/* Actividad reciente */}
      {userStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Actividad últimos 7 días */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📊 Actividad Reciente (7 días)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Tests realizados:</span>
                <span className="font-semibold">{userStats.recent.testsLast7Days}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sesiones de estudio:</span>
                <span className="font-semibold">{userStats.recent.sessionsLast7Days}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tiempo estudiado:</span>
                <span className="font-semibold">{formatDuration(userStats.recent.studyTimeLast7Days)}</span>
              </div>
            </div>
            
            {userStats.recent.testsLast7Days === 0 && (
              <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-lg">
                <p className="text-orange-800 dark:text-orange-200 text-sm">
                  ⚠️ Sin actividad en los últimos 7 días
                </p>
              </div>
            )}
          </div>

          {/* Patrones de estudio */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📅 Patrones de Estudio
            </h3>
            {Object.keys(userStats.performance.dayActivity).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(userStats.performance.dayActivity)
                  .sort(([,a], [,b]) => b - a)
                  .map(([day, count]) => (
                    <div key={day} className="flex justify-between items-center">
                      <span className="text-gray-600">{day}:</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(count / Math.max(...Object.values(userStats.performance.dayActivity))) * 100}%`
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold">{count}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Sin datos de patrones de estudio</p>
            )}
          </div>

        </div>
      )}

      {/* Historial de emails */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            📧 Historial de Emails
          </h3>
          <button
            onClick={loadUserEmails}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            🔄 Actualizar
          </button>
        </div>

        {emailLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-500">Cargando emails...</p>
          </div>
        ) : userEmails.length > 0 ? (
          <div className="space-y-3">
            {userEmails.map((email, index) => (
              <div key={email.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">
                    {email.email_type === 'medal' ? '🏆' :
                     email.email_type === 'motivation' ? '📧' :
                     email.email_type === 'reactivation' ? '🔄' : '📮'}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {email.subject || 'Sin asunto'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(email.created_at).toLocaleDateString('es-ES')} • {email.email_type} • {email.event_type}
                      {email.template_id && ` • ${email.template_id}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    email.event_type === 'clicked' ? 'bg-green-100 text-green-800' :
                    email.event_type === 'opened' ? 'bg-blue-100 text-blue-800' :
                    email.event_type === 'delivered' ? 'bg-purple-100 text-purple-800' :
                    email.event_type === 'sent' ? 'bg-yellow-100 text-yellow-800' :
                    email.event_type === 'bounced' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {email.event_type === 'clicked' ? '🖱️ Clicked' :
                     email.event_type === 'opened' ? '👁️ Abierto' :
                     email.event_type === 'delivered' ? '✅ Entregado' :
                     email.event_type === 'sent' ? '📤 Enviado' :
                     email.event_type === 'bounced' ? '❌ Rebotado' :
                     '📮 Evento'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {email.resend_id && `ID: ${email.resend_id.slice(-8)}`}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Resumen de emails */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{userEmails.length}</div>
                  <div className="text-gray-600">Total eventos</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-yellow-600">
                    {userEmails.filter(e => e.event_type === 'sent').length}
                  </div>
                  <div className="text-gray-600">Enviados</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-green-600">
                    {userEmails.filter(e => e.event_type === 'opened').length}
                  </div>
                  <div className="text-gray-600">Abiertos</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-purple-600">
                    {userEmails.filter(e => e.event_type === 'clicked').length}
                  </div>
                  <div className="text-gray-600">Clicks</div>
                </div>
              </div>
            </div>
            
            {/* Enlace para ver historial completo */}
            <div className="text-center pt-4">
              <Link 
                href={`/admin/usuarios/${userId}/emails`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                📧 Ver Historial Completo de Emails
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-500 mb-4">Este usuario no ha recibido emails automáticos</p>
            
            {!user?.is_active_student && (
              <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 text-center">
                <p className="text-blue-700 text-sm">
                  📧 <strong>Sistema automático activo</strong><br />
                  Los emails de reactivación se envían automáticamente
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Artículos con peor rendimiento */}
      {userStats && userStats.performance.articlePerformance.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📚 Artículos que Necesitan Más Atención
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artículo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Intentos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accuracy</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recomendación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {userStats.performance.articlePerformance.slice(0, 5).map((article, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {article.article}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {article.attempts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        article.accuracy >= 70 ? 'bg-green-100 text-green-800' :
                        article.accuracy >= 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {article.accuracy}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {article.accuracy < 50 ? '📚 Repasar teoría' :
                       article.accuracy < 70 ? '🎯 Más práctica' :
                       '✅ Continuar así'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historial de tests */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📋 Historial de Tests ({userTests.length})
        </h3>
        {userTests.length > 0 ? (
          <div className="space-y-3">
            {userTests.slice(0, 10).map((test, index) => (
              <div key={test.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className={`text-xl ${test.is_completed ? '✅' : '💔'}`}></span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {test.title || `Test Tema ${test.tema_number || 'X'}`}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(test.started_at).toLocaleDateString('es-ES')} • {test.total_questions} preguntas
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {test.is_completed ? (
                    <>
                      <div className="font-semibold text-green-600">
                        {test.score || 0}/{test.total_questions}
                      </div>
                      <div className="text-sm text-gray-500">
                        {Math.round((test.score || 0) / test.total_questions * 100)}%
                      </div>
                    </>
                  ) : (
                    <div className="text-red-600 font-semibold">Abandonado</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-gray-500">Este usuario no ha realizado ningún test aún</p>
            <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 text-center mt-4">
              <p className="text-blue-700 text-sm">
                  📧 <strong>Sistema automático activo</strong><br />

                Los emails de motivación se envían automáticamente
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Eliminar Usuario
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Esta acción eliminará permanentemente al usuario <strong>{user?.email}</strong> y todos sus datos asociados:
              </p>
              <ul className="text-sm text-gray-500 mt-3 text-left list-disc list-inside">
                <li>Perfil y datos personales</li>
                <li>Todos los tests y respuestas</li>
                <li>Sesiones de estudio</li>
                <li>Historial de emails</li>
                <li>Subscripciones</li>
                <li>Feedback e impugnaciones</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Escribe <strong>ELIMINAR</strong> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="ELIMINAR"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={deleteLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteConfirmText !== 'ELIMINAR' || deleteLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? '⏳ Eliminando...' : '🗑️ Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
