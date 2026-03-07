// app/admin/page.js - Dashboard con API v2 Drizzle
'use client'
import { useState, useEffect } from 'react'
import AdminActivityChart from '@/components/AdminActivityChart'
import AdminRegistrationsChart from '@/components/AdminRegistrationsChart'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [emailStats, setEmailStats] = useState(null)
  const [users, setUsers] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [activeUsersLastWeekAtThisHour, setActiveUsersLastWeekAtThisHour] = useState(0)
  const [activeUsersYesterday, setActiveUsersYesterday] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [showActivity, setShowActivity] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true)
        const res = await fetch('/api/v2/admin/dashboard')
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
        const data = await res.json()

        setStats(data.stats)
        setEmailStats(data.emailStats)
        setUsers(data.users || [])
        setRecentActivity(data.recentActivity || [])
        setActiveUsersLastWeekAtThisHour(data.activeUsersLastWeekAtThisHour)
        setActiveUsersYesterday(data.activeUsersYesterday)
        setOnlineUsers(data.onlineUsers || [])
      } catch (err) {
        console.error('Error cargando dashboard:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  function formatTimeAgo(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Ahora'
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">📊 Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          Error cargando dashboard
        </h3>
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <p className="text-red-500 dark:text-red-300 text-xs mt-2">
          💡 Desliza hacia abajo para actualizar
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            📊 Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            Resumen de la plataforma Vence
          </p>
        </div>
        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Actualizado: {new Date().toLocaleString('es-ES', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>

      {/* Métricas principales - Mobile responsive */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          
          {/* Total de usuarios */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                  Total Usuarios
                </p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalUsers}</p>
                <div className="text-xs text-green-600 mt-1">
                  <div>+{stats.newUsersThisWeek} esta semana</div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-medium">
                    🌱 {stats.newUsersThisWeekBySource?.organic || 0} Orgánico • 💰 {stats.newUsersThisWeekBySource?.google_ads || 0} Google • 📘 {stats.newUsersThisWeekBySource?.meta_ads || 0} Meta
                  </div>
                  {(stats.newUsersThisWeek > 0 || stats.newUsersLast30Days > 0) && stats.weeklyGrowthRate !== undefined && (
                    <div className="text-xs mt-2 font-medium space-y-1">
                      {/* Tendencia semanal */}
                      <div className={`flex items-center gap-1 ${stats.isGrowing ? 'text-green-600' : 'text-red-600'}`}>
                        <span>{stats.isGrowing ? '📈' : '📉'}</span>
                        <span>Semanal: {stats.weeklyGrowthRate > 0 ? '+' : ''}{(stats.weeklyGrowthRate || 0).toFixed(0)}%</span>
                        <span className="text-gray-500 text-[10px]">
                          ({stats.newUsersLastWeek || 0}→{(stats.projectedUsersPerWeek || 0).toFixed(0)})
                        </span>
                      </div>
                      {/* Tendencia mensual */}
                      <div className={`flex items-center gap-1 ${stats.isGrowingMonthly ? 'text-green-600' : 'text-red-600'}`}>
                        <span>{stats.isGrowingMonthly ? '📈' : '📉'}</span>
                        <span>Mensual: {stats.monthlyGrowthRate > 0 ? '+' : ''}{(stats.monthlyGrowthRate || 0).toFixed(0)}%</span>
                        <span className="text-gray-500 text-[10px]">
                          ({stats.newUsersPrevious30Days || 0}→{stats.newUsersLast30Days || 0})
                        </span>
                      </div>
                      {/* Proyecciones */}
                      <div className="pt-1 border-t border-gray-200 dark:border-gray-600 mt-1">
                        <div className="text-purple-600">
                          Proyección 1 año:
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-[10px] space-y-0.5">
                          <div>• Base semanal: ~{(stats.projectedUsersNextYear || 0).toLocaleString()}</div>
                          <div>• Base mensual: ~{(stats.projectedUsersNextYearMonthly || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg sm:text-2xl">👥</span>
              </div>
            </div>
          </div>

          {/* Engagement Rate - CON AMBAS MÉTRICAS */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                  Usuarios Activos
                </p>
                {/* Métrica principal: Han respondido al menos 1 pregunta */}
                <p className="text-xl sm:text-2xl font-bold text-green-600">
                  {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%
                </p>
                <p className="text-xs text-green-600 font-medium">
                  {stats.activeUsers}/{stats.totalUsers} respondieron ≥1 pregunta
                </p>

                {/* Métrica secundaria: Han completado tests */}
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-sm font-bold text-blue-600">{stats.engagementRate}%</p>
                  <p className="text-xs text-gray-500">
                    {stats.usersWhoCompletedTests}/{stats.totalUsers} completaron test
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg sm:text-2xl">🎯</span>
              </div>
            </div>
          </div>

          {/* Usuarios activos hoy */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                  Usuarios Activos Hoy
                </p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-xl sm:text-2xl font-bold text-purple-600">
                    {(() => {
                      const uniqueUserIds = [...new Set(recentActivity.map(a => a.user_id))]
                      return uniqueUserIds.length
                    })()}
                  </p>
                  <span className="text-xs text-gray-500">
                    vs {activeUsersLastWeekAtThisHour} sem. pasada
                  </span>
                  {(() => {
                    const today = [...new Set(recentActivity.map(a => a.user_id))].length
                    const lastWeek = activeUsersLastWeekAtThisHour
                    if (lastWeek === 0) return today > 0 ? <span className="text-xs font-medium text-green-600">+100%</span> : null
                    const change = Math.round(((today - lastWeek) / lastWeek) * 100)
                    const color = change >= 0 ? 'text-green-600' : 'text-red-600'
                    const sign = change >= 0 ? '+' : ''
                    return <span className={`text-xs font-medium ${color}`}>{sign}{change}%</span>
                  })()}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.testsCompletedToday > 0
                    ? (() => {
                        const activeUsers = recentActivity.map(a => a.user_profiles?.full_name?.split(' ')[0] || a.user_profiles?.email?.split('@')[0] || 'Usuario')
                        const uniqueUsers = [...new Set(activeUsers)]
                        return uniqueUsers.join(', ')
                      })()
                    : 'Sin actividad hoy'
                  }
                </p>
                {/* Desglose Premium vs Free de usuarios activos hoy */}
                {(() => {
                  // Obtener usuarios únicos con su info de premium
                  const uniqueUsersMap = new Map()
                  recentActivity.forEach(a => {
                    if (!uniqueUsersMap.has(a.user_id)) {
                      uniqueUsersMap.set(a.user_id, a.user_profiles?.is_premium)
                    }
                  })
                  const premiumCount = [...uniqueUsersMap.values()].filter(v => v === true).length
                  const freeCount = [...uniqueUsersMap.values()].filter(v => v !== true).length
                  const total = uniqueUsersMap.size
                  const premiumPct = total > 0 ? Math.round((premiumCount / total) * 100) : 0

                  if (total === 0) return null

                  return (
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <span className="text-amber-600 dark:text-amber-400">💎 {premiumCount}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-500">{freeCount} free</span>
                      <span className="text-gray-400">|</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">{premiumPct}% premium</span>
                    </div>
                  )
                })()}
                <p className="text-xs text-gray-500 mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                  Ayer: {activeUsersYesterday}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg sm:text-2xl">👤</span>
              </div>
            </div>
          </div>

          {/* Usuarios Registrados Hoy por Fuente */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                  Registros Hoy
                </p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.newUsersToday}</p>
                  <span className="text-xs text-gray-500">
                    vs {stats.newUsersLastWeekAtThisHour} sem. pasada
                  </span>
                  {(() => {
                    const today = stats.newUsersToday
                    const lastWeek = stats.newUsersLastWeekAtThisHour
                    if (lastWeek === 0) return today > 0 ? <span className="text-xs font-medium text-green-600">+100%</span> : null
                    const change = Math.round(((today - lastWeek) / lastWeek) * 100)
                    const color = change >= 0 ? 'text-green-600' : 'text-red-600'
                    const sign = change >= 0 ? '+' : ''
                    return <span className={`text-xs font-medium ${color}`}>{sign}{change}%</span>
                  })()}
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-300 mt-1 space-y-0.5">
                  <div>🌱 {stats.newUsersTodayBySource?.organic || 0} Orgánico</div>
                  <div>💰 {stats.newUsersTodayBySource?.google_ads || 0} Google</div>
                  <div>📘 {stats.newUsersTodayBySource?.meta_ads || 0} Meta</div>
                  {stats.newUsersTodayBySource?.unknown > 0 && (
                    <div>❓ {stats.newUsersTodayBySource.unknown} Otros</div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-2 pt-1 border-t border-gray-200 dark:border-gray-600">
                  Ayer total: {stats.newUsersYesterday}
                </div>
                {/* Usuarios online ahora */}
                {onlineUsers.length > 0 && (
                  <div className="mt-2 pt-1 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      {onlineUsers.length} usuarios online
                    </div>
                    <div className="space-y-0.5">
                      {onlineUsers.map(user => (
                        <div key={user.user_id} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                          <span className="truncate">
                            {user.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Usuario'}
                          </span>
                          {user.is_premium && <span className="text-amber-600">💎</span>}
                          <span className="text-gray-400 ml-auto flex-shrink-0">
                            {(() => {
                              const ago = Math.round((Date.now() - new Date(user.last_seen).getTime()) / 60000)
                              return ago < 1 ? 'ahora' : `${ago}m`
                            })()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg sm:text-2xl">📝</span>
              </div>
            </div>
          </div>


        </div>
      )}

      {/* Métricas de actividad y emails - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Actividad de usuarios */}
        {stats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📈 Actividad de Usuarios
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Usuarios con tests (total histórico):</span>
                <span className="text-base sm:text-lg font-semibold text-blue-600">{stats.usersWhoCompletedTests}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Activos esta semana:</span>
                <span className="text-base sm:text-lg font-semibold text-green-600">{stats.activeUsersThisWeek}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tests completados (30 días):</span>
                <span className="text-base sm:text-lg font-semibold text-purple-600">{stats.testsLast30Days}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tests abandonados:</span>
                <span className="text-base sm:text-lg font-semibold text-red-600">{stats.abandonedTests}</span>
              </div>
            </div>

            {/* Desglose de tests completados - Comparación 15 vs 30 días */}
            {stats.testsByMode && stats.testsByStudyType && stats.testsByMode15Days && stats.testsByStudyType15Days && (
              <div className="mt-4 space-y-3">
                {/* Modo de tests - Comparación */}
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs font-semibold text-green-800 dark:text-green-200 mb-2">
                    📝 Modo de tests completados:
                  </p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-300">
                      <div className="text-center font-semibold pb-1 border-b border-green-300 dark:border-green-700">15 días</div>
                      <div className="text-center font-semibold pb-1 border-b border-green-300 dark:border-green-700">30 días</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs text-green-700 dark:text-green-300">
                        <div className="flex justify-between">
                          <span>Práctica:</span>
                          <span className="font-semibold">{stats.testsByMode15Days.practice} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByMode15Days.practice / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>Examen:</span>
                          <span className="font-semibold">{stats.testsByMode15Days.exam} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByMode15Days.exam / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-300">
                        <div className="flex justify-between">
                          <span>Práctica:</span>
                          <span className="font-semibold">{stats.testsByMode.practice} ({Math.round((stats.testsByMode.practice / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>Examen:</span>
                          <span className="font-semibold">{stats.testsByMode.exam} ({Math.round((stats.testsByMode.exam / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tipo de estudio - Comparación */}
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-xs font-semibold text-purple-800 dark:text-purple-200 mb-2">
                    📚 Tipo de estudio:
                  </p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs text-purple-700 dark:text-purple-300">
                      <div className="text-center font-semibold pb-1 border-b border-purple-300 dark:border-purple-700">15 días</div>
                      <div className="text-center font-semibold pb-1 border-b border-purple-300 dark:border-purple-700">30 días</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
                        <div className="flex justify-between">
                          <span>Por tema:</span>
                          <span className="font-semibold">{stats.testsByStudyType15Days.porTema} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByStudyType15Days.porTema / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Aleatorio:</span>
                          <span className="font-semibold">{stats.testsByStudyType15Days.aleatorio} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByStudyType15Days.aleatorio / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Por ley:</span>
                          <span className="font-semibold">{stats.testsByStudyType15Days.porLey} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByStudyType15Days.porLey / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Personalizado:</span>
                          <span className="font-semibold">{stats.testsByStudyType15Days.personalizado} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByStudyType15Days.personalizado / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                      </div>
                      <div className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
                        <div className="flex justify-between">
                          <span>Por tema:</span>
                          <span className="font-semibold">{stats.testsByStudyType.porTema} ({Math.round((stats.testsByStudyType.porTema / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Aleatorio:</span>
                          <span className="font-semibold">{stats.testsByStudyType.aleatorio} ({Math.round((stats.testsByStudyType.aleatorio / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Por ley:</span>
                          <span className="font-semibold">{stats.testsByStudyType.porLey} ({Math.round((stats.testsByStudyType.porLey / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Personalizado:</span>
                          <span className="font-semibold">{stats.testsByStudyType.personalizado} ({Math.round((stats.testsByStudyType.personalizado / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                📊 <strong>Tasa de finalización:</strong> {stats.completionRate}% de tests se completan
              </p>
            </div>
          </div>
        )}

        {/* Estadísticas de emails - Responsive */}
        {emailStats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📧 Emails (esta semana)
            </h3>
            
            {emailStats.totalSent > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold text-blue-600">{emailStats.totalSent}</div>
                    <div className="text-xs text-gray-600">Enviados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold text-green-600">{emailStats.openRate}%</div>
                    <div className="text-xs text-gray-600">Abiertos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold text-purple-600">{emailStats.clickRate}%</div>
                    <div className="text-xs text-gray-600">Clicks</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(emailStats.byType).map(([type, stats]) => (
                    <div key={type} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm font-medium mb-1 sm:mb-0">{stats.name}</span>
                      <div className="flex space-x-2 sm:space-x-3 text-xs sm:text-sm">
                        <span className="text-blue-600">{stats.sent} env.</span>
                        <span className="text-green-600">{stats.openRate}% ab.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl sm:text-4xl mb-2">📭</div>
                <p className="text-gray-500 text-sm">Sin emails esta semana</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Gráfico de evolución temporal - Ancho completo */}
      <AdminActivityChart />

      {/* Gráfico de registros por día */}
      <AdminRegistrationsChart />

      {/* Actividad reciente - On-demand: solo se muestra al pulsar el botón */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            ⚡ Actividad Reciente (Hoy)
          </h3>
          <button
            onClick={() => setShowActivity(!showActivity)}
            className="text-xs sm:text-sm px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors font-medium"
          >
            {showActivity ? 'Ocultar' : `Ver ${recentActivity.length} tests`}
          </button>
        </div>

        {showActivity && (
          <div className="mt-4">
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-green-600 text-sm sm:text-lg">✅</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                          {activity.user_profiles?.full_name?.split(' ')[0] || activity.user_profiles?.email?.split('@')[0] || 'Usuario anónimo'}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">
                          {(() => {
                            const s = Number(activity.score)
                            const t = Number(activity.total_questions)
                            if (t <= 0) return '0/0 preguntas'
                            if (s > t) {
                              const correct = Math.round(s * t / 100)
                              return `${correct}/${t} preguntas`
                            }
                            return `${s}/${t} preguntas`
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-sm sm:text-lg font-semibold text-green-600">
                        {(() => {
                          const s = Number(activity.score)
                          const t = Number(activity.total_questions)
                          if (t <= 0) return '0%'
                          if (s > t) return `${Math.min(100, s)}%`
                          return `${Math.round((s / t) * 100)}%`
                        })()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTimeAgo(activity.completed_at || activity.started_at || activity.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8">
                <div className="text-3xl sm:text-4xl mb-4">😴</div>
                <p className="text-gray-500 text-sm sm:text-base">No hay tests completados hoy</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de usuarios - Responsive */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                👥 Usuarios Recientes
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Últimos registros y actividad
              </p>
            </div>
          </div>
        </div>


        {/* Vista móvil - Tarjetas */}
        <div className="block sm:hidden space-y-3 p-4">
          {users.slice(0, 5).map((user, index) => (
            <div key={user.user_id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.full_name || 'Sin nombre'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ml-2 ${
                  user.is_active_student 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {user.is_active_student ? '✅' : '❌'}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                📅 {new Date(user.user_created_at).toLocaleString('es-ES', { 
                  day: '2-digit', 
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Vista desktop - Tabla */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Registro
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.slice(0, 5).map((user, index) => (
                <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                      </div>
                      <div className="ml-4 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user.full_name || 'Sin nombre'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active_student 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {user.is_active_student ? '✅' : '❌'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.user_created_at).toLocaleString('es-ES', { 
                      day: '2-digit', 
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-6 sm:py-8">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No hay usuarios registrados</p>
          </div>
        )}
      </div>



    </div>
  )
}

