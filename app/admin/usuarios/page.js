// app/admin/usuarios/page.js - Gestión completa de usuarios
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

export default function UsuariosManagementPage() {
  const { supabase } = useAuth()
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState({})
  
  // Estados de filtros
  const [filter, setFilter] = useState('all') // all, active, risk, power, inactive, admin
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('activity') // activity, name, tests, accuracy

  useEffect(() => {
    loadUsers()
  }, [supabase])

  useEffect(() => {
    applyFilters()
  }, [users, filter, searchTerm, sortBy])

  async function loadUsers() {
    if (!supabase) return

    try {
      setLoading(true)
      console.log('👥 Cargando usuarios para gestión...')

      // 1. Obtener usuarios con roles
      const { data: usersWithRoles, error: usersError } = await supabase
        .from('admin_users_with_roles')
        .select('*')

      if (usersError) throw usersError

      // 2. Obtener estadísticas de tests por usuario - Con límite alto
      const { data: testStats, error: testStatsError } = await supabase
        .from('tests')
        .select(`
          user_id,
          is_completed,
          score,
          total_questions,
          created_at,
          completed_at
        `)
        .range(0, 9999) // Obtener hasta 10000 tests

      if (testStatsError) throw testStatsError

      // 3. Obtener última actividad de sesiones - Con límite alto
      const { data: lastSessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('user_id, session_start')
        .order('session_start', { ascending: false })
        .range(0, 9999) // Obtener hasta 10000 sesiones

      if (sessionsError) throw sessionsError

      // 4. Procesar datos
      const processedUsers = processUserData(usersWithRoles, testStats, lastSessions)
      setUsers(processedUsers)

      console.log('✅ Usuarios cargados:', processedUsers.length)

    } catch (err) {
      console.error('❌ Error cargando usuarios:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function processUserData(usersWithRoles, testStats, sessions) {
    return usersWithRoles.map(user => {
      // Calcular estadísticas de tests
      const userTests = testStats.filter(test => test.user_id === user.user_id)
      const completedTests = userTests.filter(test => test.is_completed)
      const abandonedTests = userTests.filter(test => !test.is_completed)
      
      const totalTests = userTests.length
      const completionRate = totalTests > 0 ? Math.round((completedTests.length / totalTests) * 100) : 0
      
      // Calcular accuracy promedio
      const totalScore = completedTests.reduce((sum, test) => sum + (test.score || 0), 0)
      const totalQuestions = completedTests.reduce((sum, test) => sum + (test.total_questions || 0), 0)
      const avgAccuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0

      // Última actividad
      const userSessions = sessions.filter(session => session.user_id === user.user_id)
      const lastActivity = userSessions.length > 0 ? userSessions[0].session_start : null
      const daysSinceLastActivity = lastActivity 
        ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : null

      // Último test
      const lastTest = userTests.length > 0 
        ? userTests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        : null
      const daysSinceLastTest = lastTest
        ? Math.floor((Date.now() - new Date(lastTest.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null

      // Clasificar usuario
      let userType = 'normal'
      let riskLevel = 'low'
      
      if (completionRate >= 80 && totalTests >= 2) {
        userType = 'power'
      } else if (totalTests === 0 || (daysSinceLastActivity && daysSinceLastActivity > 7)) {
        userType = 'risk'
        riskLevel = daysSinceLastActivity > 14 ? 'high' : 'medium'
      } else if (!user.is_active_student) {
        userType = 'inactive'
      }

      return {
        ...user,
        stats: {
          totalTests,
          completedTests: completedTests.length,
          abandonedTests: abandonedTests.length,
          completionRate,
          avgAccuracy,
          lastActivity,
          daysSinceLastActivity,
          lastTest: lastTest?.created_at,
          daysSinceLastTest
        },
        classification: {
          type: userType,
          riskLevel
        },
        roles: user.active_roles || ['user']
      }
    })
  }

  function applyFilters() {
    let filtered = [...users]

    // Filtro por tipo
    if (filter !== 'all') {
      filtered = filtered.filter(user => {
        switch (filter) {
          case 'active':
            return user.is_active_student
          case 'inactive':
            return !user.is_active_student
          case 'risk':
            return user.classification.type === 'risk'
          case 'power':
            return user.classification.type === 'power'
          case 'admin':
            return user.roles.includes('admin') || user.roles.includes('super_admin')
          default:
            return true
        }
      })
    }

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.full_name || a.email).localeCompare(b.full_name || b.email)
        case 'tests':
          return b.stats.totalTests - a.stats.totalTests
        case 'accuracy':
          return b.stats.avgAccuracy - a.stats.avgAccuracy
        case 'activity':
        default:
          // Ordenar por última actividad (más reciente primero)
          if (!a.stats.lastActivity && !b.stats.lastActivity) return 0
          if (!a.stats.lastActivity) return 1
          if (!b.stats.lastActivity) return -1
          return new Date(b.stats.lastActivity) - new Date(a.stats.lastActivity)
      }
    })

    setFilteredUsers(filtered)
  }

  async function handleRoleAction(userId, action, currentRoles) {
    setActionLoading(prev => ({ ...prev, [userId]: action }))
    
    try {
      if (action === 'promote_admin') {
        const { error } = await supabase.rpc('assign_role', {
          p_user_id: userId,
          p_role: 'admin',
          p_notes: 'Promovido a admin desde panel de gestión'
        })
        if (error) throw error
        
      } else if (action === 'remove_admin') {
        const { error } = await supabase
          .from('user_roles')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('role', 'admin')
        if (error) throw error
      }
      
      // Recargar usuarios
      await loadUsers()
      console.log(`✅ Acción ${action} completada para usuario ${userId}`)
      
    } catch (err) {
      console.error(`❌ Error en acción ${action}:`, err)
      alert(`Error: ${err.message}`)
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }))
    }
  }

  function getUserTypeColor(user) {
    switch (user.classification.type) {
      case 'power':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'risk':
        return user.classification.riskLevel === 'high' 
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      case 'inactive':
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
      default:
        return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }
  }

  function getUserTypeIcon(user) {
    switch (user.classification.type) {
      case 'power': return '🏆'
      case 'risk': return user.classification.riskLevel === 'high' ? '🚨' : '⚠️'
      case 'inactive': return '😴'
      default: return '👤'
    }
  }

  function formatLastActivity(user) {
    if (!user.stats.lastActivity) return 'Nunca'
    if (user.stats.daysSinceLastActivity === 0) return 'Hoy'
    if (user.stats.daysSinceLastActivity === 1) return 'Ayer'
    return `Hace ${user.stats.daysSinceLastActivity} días`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">👥 Cargando gestión de usuarios...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Error cargando usuarios</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button 
          onClick={loadUsers}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          🔄 Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            👥 Gestión de Usuarios
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Administra usuarios, roles y realiza acciones específicas
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={loadUsers}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            🔄 Actualizar
          </button>
          <Link 
            href="/admin" 
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Estadísticas rápidas - Clickeable para filtrar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div 
          onClick={() => setFilter('all')}
          className={`bg-white dark:bg-gray-800 rounded-lg p-4 border cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
            filter === 'all' ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
        >
          <div className="text-2xl font-bold text-blue-600">{users.length}</div>
          <div className="text-sm text-gray-600">📊 Total Usuarios</div>
          {filter === 'all' && <div className="text-xs text-blue-600 mt-1">• Filtro activo</div>}
        </div>
        <div 
          onClick={() => setFilter('power')}
          className={`bg-white dark:bg-gray-800 rounded-lg p-4 border cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
            filter === 'power' ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20' : ''
          }`}
        >
          <div className="text-2xl font-bold text-green-600">
            {users.filter(u => u.classification.type === 'power').length}
          </div>
          <div className="text-sm text-gray-600">🏆 Power Users</div>
          {filter === 'power' && <div className="text-xs text-green-600 mt-1">• Filtro activo</div>}
        </div>
        <div 
          onClick={() => setFilter('risk')}
          className={`bg-white dark:bg-gray-800 rounded-lg p-4 border cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
            filter === 'risk' ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-900/20' : ''
          }`}
        >
          <div className="text-2xl font-bold text-orange-600">
            {users.filter(u => u.classification.type === 'risk').length}
          </div>
          <div className="text-sm text-gray-600">⚠️ En Riesgo</div>
          {filter === 'risk' && <div className="text-xs text-orange-600 mt-1">• Filtro activo</div>}
        </div>
        <div 
          onClick={() => setFilter('inactive')}
          className={`bg-white dark:bg-gray-800 rounded-lg p-4 border cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
            filter === 'inactive' ? 'ring-2 ring-gray-500 bg-gray-50 dark:bg-gray-900/20' : ''
          }`}
        >
          <div className="text-2xl font-bold text-gray-600">
            {users.filter(u => !u.is_active_student).length}
          </div>
          <div className="text-sm text-gray-600">😴 Inactivos</div>
          {filter === 'inactive' && <div className="text-xs text-gray-600 mt-1">• Filtro activo</div>}
        </div>
        <div 
          onClick={() => setFilter('admin')}
          className={`bg-white dark:bg-gray-800 rounded-lg p-4 border cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
            filter === 'admin' ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' : ''
          }`}
        >
          <div className="text-2xl font-bold text-purple-600">
            {users.filter(u => u.roles.includes('admin') || u.roles.includes('super_admin')).length}
          </div>
          <div className="text-sm text-gray-600">👑 Administradores</div>
          {filter === 'admin' && <div className="text-xs text-purple-600 mt-1">• Filtro activo</div>}
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
        <div className="flex flex-col md:flex-row gap-4">
          
          {/* Búsqueda */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Filtro por tipo */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">Todos los usuarios</option>
            <option value="active">👤 Activos</option>
            <option value="inactive">😴 Inactivos</option>
            <option value="power">🏆 Power Users</option>
            <option value="risk">⚠️ En Riesgo</option>
            <option value="admin">👑 Administradores</option>
          </select>

          {/* Ordenamiento */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="activity">📅 Última actividad</option>
            <option value="name">🔤 Nombre</option>
            <option value="tests">📊 Más tests</option>
            <option value="accuracy">🎯 Mejor accuracy</option>
          </select>
        </div>

        {/* Contador de resultados */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Mostrando {filteredUsers.length} de {users.length} usuarios
          {searchTerm && ` con "${searchTerm}"`}
          {filter !== 'all' && ` • Filtro: ${filter}`}
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <div 
            key={user.user_id} 
            className={`rounded-lg border p-6 transition-all hover:shadow-lg ${getUserTypeColor(user)}`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Información principal del usuario */}
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user.full_name || 'Sin nombre'}
                    </h3>
                    <span className="text-xl">{getUserTypeIcon(user)}</span>
                    {user.roles.includes('super_admin') && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                        👑 Super Admin
                      </span>
                    )}
                    {user.roles.includes('admin') && !user.roles.includes('super_admin') && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                        👨‍💼 Admin
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <span>📅 Última actividad: {formatLastActivity(user)}</span>
                    <span>📊 {user.stats.totalTests} tests</span>
                    {user.stats.avgAccuracy > 0 && (
                      <span>🎯 {user.stats.avgAccuracy}% accuracy</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Estadísticas y estado */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-w-0 lg:min-w-[400px]">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {user.stats.completionRate}%
                  </div>
                  <div className="text-xs text-gray-500">Completion</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {user.stats.completedTests}
                  </div>
                  <div className="text-xs text-gray-500">Completados</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {user.stats.abandonedTests}
                  </div>
                  <div className="text-xs text-gray-500">Abandonados</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${
                    user.is_active_student ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {user.is_active_student ? '✅' : '❌'}
                  </div>
                  <div className="text-xs text-gray-500">Activo</div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 min-w-0 lg:min-w-[200px]">
                
                {/* Ver detalles */}
                <Link
                  href={`/admin/usuarios/${user.user_id}`}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  👁️ Ver Detalles
                </Link>

                {/* Ver emails */}
                <Link
                  href={`/admin/usuarios/${user.user_id}/emails`}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  📧 Ver Emails
                </Link>

                {/* Gestión de roles */}
                {!user.roles.includes('super_admin') && (
                  <>
                    {!user.roles.includes('admin') ? (
                      <button
                        onClick={() => handleRoleAction(user.user_id, 'promote_admin', user.roles)}
                        disabled={actionLoading[user.user_id] === 'promote_admin'}
                        className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm disabled:opacity-50"
                      >
                        {actionLoading[user.user_id] === 'promote_admin' ? '⏳' : '👑'} Hacer Admin
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRoleAction(user.user_id, 'remove_admin', user.roles)}
                        disabled={actionLoading[user.user_id] === 'remove_admin'}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                      >
                        {actionLoading[user.user_id] === 'remove_admin' ? '⏳' : '👤'} Quitar Admin
                      </button>
                    )}
                  </>
                )}

                {/* Acciones específicas por tipo */}
                {user.classification.type === 'risk' && (
                  <button
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    onClick={() => alert(`Funcionalidad de reactivación para ${user.email} en desarrollo`)}
                  >
                    📧 Reactivar
                  </button>
                )}

                {user.classification.type === 'power' && !user.roles.includes('admin') && (
                  <button
                    onClick={() => handleRoleAction(user.user_id, 'promote_admin', user.roles)}
                    disabled={actionLoading[user.user_id] === 'promote_admin'}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {actionLoading[user.user_id] === 'promote_admin' ? '⏳' : '⭐'} Promover
                  </button>
                )}
              </div>
            </div>

            {/* Alertas específicas */}
            {user.classification.type === 'risk' && user.classification.riskLevel === 'high' && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-200 text-sm">
                  🚨 <strong>Alta prioridad:</strong> Usuario sin actividad por {user.stats.daysSinceLastActivity} días. 
                  Requiere intervención inmediata.
                </p>
              </div>
            )}

            {user.classification.type === 'power' && !user.roles.includes('admin') && (
              <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-800 dark:text-green-200 text-sm">
                  🏆 <strong>Power User:</strong> Excelente rendimiento ({user.stats.completionRate}% completion). 
                  Candidato ideal para rol de moderador.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mensaje si no hay usuarios */}
      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No se encontraron usuarios
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || filter !== 'all' 
              ? 'Prueba ajustando los filtros o la búsqueda'
              : 'No hay usuarios registrados'
            }
          </p>
        </div>
      )}

    </div>
  )
}
