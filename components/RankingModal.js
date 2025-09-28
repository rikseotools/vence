'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function RankingModal({ isOpen, onClose }) {
  const { user, supabase } = useAuth()
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentUserRank, setCurrentUserRank] = useState(null)
  const [timeFilter, setTimeFilter] = useState('week') // 'yesterday', 'today', 'week', 'month'

  useEffect(() => {
    if (isOpen && user && supabase) {
      loadRanking()
    }
  }, [isOpen, user, supabase, timeFilter])

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  const loadRanking = async () => {
    setLoading(true)
    try {
      let dateFilter = ''
      const now = new Date()
      
      if (timeFilter === 'yesterday') {
        // Solo ayer - desde las 00:00 de ayer hasta las 23:59 de ayer
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        yesterday.setHours(0, 0, 0, 0)
        const yesterdayEnd = new Date()
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1)
        yesterdayEnd.setHours(23, 59, 59, 999)
        
        dateFilter = { start: yesterday.toISOString(), end: yesterdayEnd.toISOString() }
      } else if (timeFilter === 'today') {
        // Solo hoy - desde las 00:00 hasta las 23:59 de hoy
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)
        dateFilter = { start: today.toISOString(), end: todayEnd.toISOString() }
      } else if (timeFilter === 'week') {
        // Esta semana - desde el lunes 0:00
        const monday = new Date()
        const dayOfWeek = monday.getDay() === 0 ? 6 : monday.getDay() - 1 // Domingo = 6, Lunes = 0
        monday.setDate(monday.getDate() - dayOfWeek)
        monday.setHours(0, 0, 0, 0)
        dateFilter = monday.toISOString()
      } else if (timeFilter === 'month') {
        // Este mes - desde el día 1 del mes actual (en UTC)
        const firstDayOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0))
        dateFilter = firstDayOfMonth.toISOString()
      }

      // Consulta para obtener ranking de usuarios - SIN USER_PROFILES (RLS bloqueado)
      // Cuenta TODAS las preguntas (de tests completos E incompletos)
      let query = supabase
        .from('test_questions')
        .select(`
          tests!inner(user_id),
          is_correct,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (dateFilter) {
        if (typeof dateFilter === 'object' && dateFilter.start && dateFilter.end) {
          // For "today" filter with start and end range
          query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end)
        } else {
          // For other filters with just a start date
          query = query.gte('created_at', dateFilter)
        }
      }

      const { data: responses, error } = await query.limit(100000)

      if (error) {
        console.error('Error loading ranking:', error)
        return
      }

      // Procesar datos para calcular estadísticas por usuario
      const userStats = {}
      let processedResponses = 0
      let skippedResponses = 0
      
      responses?.forEach(response => {
        const userId = response.tests?.user_id
        if (!userId) {
          skippedResponses++
          return
        }
        
        processedResponses++
        if (!userStats[userId]) {
          userStats[userId] = {
            userId,
            totalQuestions: 0,
            correctAnswers: 0,
            accuracy: 0
          }
        }
        
        userStats[userId].totalQuestions++
        if (response.is_correct) {
          userStats[userId].correctAnswers++
        }
      })

      console.log(`🔍 DEBUG ${timeFilter} - PROCESSING DETAILS:`, {
        totalResponsesReceived: responses?.length,
        processedResponses,
        skippedResponses,
        uniqueUsersInStats: Object.keys(userStats).length,
        sampleResponse: responses?.[0]
      })

      // Calcular accuracy y filtrar usuarios con al menos 1 pregunta
      const rankingData = Object.values(userStats)
        .filter(user => user.totalQuestions >= 1)
        .map(user => ({
          ...user,
          accuracy: Math.round((user.correctAnswers / user.totalQuestions) * 100)
        }))
        .sort((a, b) => {
          // Ordenar por accuracy, luego por total de preguntas
          if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
          return b.totalQuestions - a.totalQuestions
        })

      // Obtener nombres de usuarios - todos los usuarios del ranking
      const topUsers = rankingData // Mostrar todos, no limitar a 10
      const userIds = topUsers.map(u => u.userId)
      
      // Incluir usuario actual si no está en el ranking
      if (user && !userIds.includes(user.id)) {
        userIds.push(user.id)
      }

      // Obtener nombres desde admin_users_with_roles (sin RLS)
      console.log('🔍 Loading admin profiles for userIds:', userIds)
      const { data: adminProfiles, error: adminProfilesError } = await supabase
        .from('admin_users_with_roles')
        .select('user_id, full_name, email')
        .in('user_id', userIds)

      console.log('📊 Admin profiles loaded:', adminProfiles?.length)
      console.log('❌ Admin profile error:', adminProfilesError)

      if (adminProfilesError) {
        console.error('Error loading admin user profiles:', adminProfilesError)
      }

      // También intentar obtener display_names personalizados
      const { data: customProfiles, error: customProfileError } = await supabase
        .from('public_user_profiles')
        .select('id, display_name')
        .in('id', userIds)

      if (customProfileError) {
        console.warn('Custom profiles not accessible (RLS):', customProfileError)
      }

      // Función para obtener nombre a mostrar
      const getDisplayName = (userId) => {
        // 1. Buscar display_name personalizado
        const customProfile = customProfiles?.find(p => p.id === userId)
        if (customProfile?.display_name) {
          return customProfile.display_name
        }
        
        // 2. Buscar en admin_users_with_roles
        const adminProfile = adminProfiles?.find(p => p.user_id === userId)
        
        // 3. Si es el usuario actual y no hay perfil, usar datos del contexto
        if (userId === user?.id) {
          if (user?.user_metadata?.full_name) {
            const firstName = user.user_metadata.full_name.split(' ')[0]
            if (firstName?.trim()) return firstName.trim()
          }
          if (user?.email) {
            return user.email.split('@')[0]
          }
          return 'Tú'
        }
        
        // 4. Para otros usuarios, usar primer nombre del admin profile
        if (adminProfile?.full_name) {
          const firstName = adminProfile.full_name.split(' ')[0]
          if (firstName?.trim()) return firstName.trim()
        }
        
        // 5. Fallback a email sin dominio del admin profile
        if (adminProfile?.email) {
          return adminProfile.email.split('@')[0]
        }
        
        // 6. Último recurso: nombre genérico sin números
        return 'Usuario anónimo'
      }

      // Combinar datos con nombres reales
      const finalRanking = topUsers.map((stats, index) => {
        return {
          ...stats,
          rank: index + 1,
          name: getDisplayName(stats.userId),
          isCurrentUser: stats.userId === user?.id
        }
      })

      setRanking(finalRanking)
      
      // Encontrar posición del usuario actual en todo el ranking
      const allRankingUserRank = rankingData.findIndex(u => u.userId === user?.id) + 1
      if (allRankingUserRank > 0) {
        const userStats = rankingData.find(u => u.userId === user?.id)
        const userDisplayName = getDisplayName(user?.id)
        setCurrentUserRank({
          ...userStats,
          rank: allRankingUserRank,
          name: userDisplayName,
          isCurrentUser: true
        })
      }

    } catch (error) {
      console.error('Error loading ranking:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return '🏅'
    }
  }

  const getRankColor = (rank) => {
    if (rank === 1) return 'text-yellow-600'
    if (rank === 2) return 'text-gray-500'
    if (rank === 3) return 'text-amber-600'
    return 'text-gray-400'
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] overflow-y-auto"
    >
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl w-[90%] max-w-sm sm:w-full sm:max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold flex items-center">
              🏆 Ranking de Opositores
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm">Clasificación de estudiantes</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <span className="text-white font-bold">×</span>
          </button>
        </div>

        <div className="p-3 sm:p-6 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {/* Filtros de tiempo */}
          <div className="flex justify-center space-x-2 mb-6">
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setTimeFilter('yesterday')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'yesterday'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ayer
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Esta semana
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Este mes
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando ranking...</p>
            </div>
          ) : (
            <>
              {/* Tu posición */}
              {currentUserRank && currentUserRank.rank > 10 && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getRankIcon(currentUserRank.rank)}</span>
                      <div>
                        <p className="font-bold text-blue-700">Tu posición: #{currentUserRank.rank}</p>
                        <p className="text-sm text-blue-600">{currentUserRank.accuracy}% de aciertos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">{currentUserRank.accuracy}%</div>
                      <div className="text-xs text-gray-500">{currentUserRank.totalQuestions} preguntas</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Top 10 */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-800 mb-4 text-center">
                  🏆 Top Estudiantes
                </h3>
                
                {ranking.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🏆</div>
                    <p className="text-gray-600">¡Sé el primero en el ranking!</p>
                    <p className="text-sm text-gray-500">Responde al menos 5 preguntas para aparecer</p>
                  </div>
                ) : (
                  ranking.map((user) => (
                    <div
                      key={user.userId}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        user.isCurrentUser 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg ${getRankColor(user.rank)}`}>
                          {user.rank <= 3 ? getRankIcon(user.rank) : `#${user.rank}`}
                        </div>
                        <div>
                          <p className={`font-medium ${user.isCurrentUser ? 'text-blue-700' : 'text-gray-800'}`}>
                            {user.name}
                            {user.isCurrentUser && <span className="ml-1 text-blue-600 text-sm">(Tú)</span>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {user.correctAnswers} correctas sobre {user.totalQuestions} totales
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-bold text-green-600">{user.accuracy}%</div>
                        <div className="text-xs text-gray-400">{user.totalQuestions} preguntas</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-xs text-gray-500">
              Mínimo 5 preguntas para aparecer en el ranking
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}