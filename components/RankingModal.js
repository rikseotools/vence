'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
// import { calculateUserStreak } from '@/utils/streakCalculator' // 🚫 YA NO NECESARIO

export default function RankingModal({ isOpen, onClose }) {
  const { user, supabase } = useAuth()
  const [ranking, setRanking] = useState([])
  const [streakRanking, setStreakRanking] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentUserRank, setCurrentUserRank] = useState(null)
  const [timeFilter, setTimeFilter] = useState('week') // 'yesterday', 'today', 'week', 'month'
  const [activeTab, setActiveTab] = useState('ranking') // 'ranking', 'rachas'

  useEffect(() => {
    if (isOpen && user && supabase) {
      if (activeTab === 'ranking') {
        loadRanking()
      } else if (activeTab === 'rachas') {
        loadStreakRanking()
      }
    }
  }, [isOpen, user, supabase, timeFilter, activeTab])

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
    // Limpiar estado anterior para evitar mostrar datos viejos
    setRanking([])
    setCurrentUserRank(null)

    try {
      // ⚡ OPTIMIZADO: Calcular fechas usando UTC consistentemente (arregla bug #1)
      let startDate, endDate = null
      const now = new Date()

      if (timeFilter === 'yesterday') {
        const yesterday = new Date()
        yesterday.setUTCDate(yesterday.getUTCDate() - 1)
        yesterday.setUTCHours(0, 0, 0, 0)
        startDate = yesterday.toISOString()

        const yesterdayEnd = new Date(yesterday)
        yesterdayEnd.setUTCHours(23, 59, 59, 999)
        endDate = yesterdayEnd.toISOString()
      } else if (timeFilter === 'today') {
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        startDate = today.toISOString()

        const todayEnd = new Date(today)
        todayEnd.setUTCHours(23, 59, 59, 999)
        endDate = todayEnd.toISOString()
      } else if (timeFilter === 'week') {
        // Esta semana - desde el lunes 0:00 UTC (arregla bug #1)
        const monday = new Date()
        const dayOfWeek = monday.getUTCDay() === 0 ? 6 : monday.getUTCDay() - 1
        monday.setUTCDate(monday.getUTCDate() - dayOfWeek)
        monday.setUTCHours(0, 0, 0, 0)
        startDate = monday.toISOString()
        // endDate = null → hasta ahora
      } else if (timeFilter === 'month') {
        // Este mes - desde el día 1 del mes actual en UTC
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
        startDate = firstDay.toISOString()
        // endDate = null → hasta ahora
      }

      console.log(`🔍 Cargando ranking ${timeFilter}:`, { startDate, endDate })

      // ⚡ OPTIMIZADO: Usar función RPC en lugar de procesar 100k respuestas (arregla bug #3)
      const { data: rankingData, error } = await supabase.rpc('get_ranking_for_period', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_min_questions: 5,
        p_limit: 100
      })

      if (error) {
        console.error('Error loading ranking:', error)
        return
      }

      console.log(`📊 Ranking ${timeFilter} obtenido:`, rankingData?.length, 'usuarios')

      // Obtener nombres de usuarios - todos los usuarios del ranking
      const topUsers = rankingData || []
      const userIds = topUsers.map(u => u.user_id)
      
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
          userId: stats.user_id,
          totalQuestions: Number(stats.total_questions),
          correctAnswers: Number(stats.correct_answers),
          accuracy: Number(stats.accuracy),
          rank: index + 1,
          name: getDisplayName(stats.user_id),
          isCurrentUser: stats.user_id === user?.id
        }
      })

      setRanking(finalRanking)

      // Obtener posición del usuario actual (incluso si no está en top 100)
      const userInRanking = finalRanking.find(u => u.userId === user?.id)
      if (userInRanking) {
        setCurrentUserRank(userInRanking)
      } else if (user) {
        // Usuario no está en top 100, usar función RPC para obtener su posición exacta
        const { data: userPosition, error: positionError } = await supabase.rpc('get_user_ranking_position', {
          p_user_id: user.id,
          p_start_date: startDate,
          p_end_date: endDate,
          p_min_questions: 5
        })

        if (positionError) {
          console.error('Error getting user position:', positionError)
          // Limpiar estado antiguo cuando hay error
          setCurrentUserRank(null)
        } else if (userPosition && userPosition.length > 0) {
          const pos = userPosition[0]
          setCurrentUserRank({
            userId: user.id,
            totalQuestions: Number(pos.total_questions),
            correctAnswers: Number(pos.correct_answers),
            accuracy: Number(pos.accuracy),
            rank: Number(pos.user_rank),
            name: getDisplayName(user.id),
            isCurrentUser: true
          })
        } else {
          // Usuario no califica para el ranking (< 5 preguntas)
          setCurrentUserRank(null)
        }
      } else {
        // No hay usuario logueado
        setCurrentUserRank(null)
      }

    } catch (error) {
      console.error('Error loading ranking:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStreakRanking = async () => {
    setLoading(true)
    try {
      // ⚡ SÚPER OPTIMIZADO: Obtener todas las rachas directamente desde user_streaks
      const { data: streakData, error } = await supabase
        .from('user_streaks')
        .select('user_id, current_streak')
        .gte('current_streak', 2) // Solo usuarios con racha >= 2 días
        .order('current_streak', { ascending: false })
        .limit(20) // Top 20 rachas

      if (error) {
        console.error('Error loading streak ranking:', error)
        return
      }


      // Transformar datos al formato esperado
      const filteredStreaks = streakData?.map(item => ({
        userId: item.user_id,
        streak: item.current_streak
      })) || []

      // Obtener nombres de usuarios
      const userIds = filteredStreaks.map(u => u.userId)
      
      // Incluir usuario actual si no está en el ranking
      if (user && !userIds.includes(user.id)) {
        userIds.push(user.id)
      }

      const { data: adminProfiles, error: adminProfilesError } = await supabase
        .from('admin_users_with_roles')
        .select('user_id, full_name, email')
        .in('user_id', userIds)

      if (adminProfilesError) {
        console.error('Error loading admin user profiles:', adminProfilesError)
      }

      const { data: customProfiles, error: customProfileError } = await supabase
        .from('public_user_profiles')
        .select('id, display_name')
        .in('id', userIds)

      if (customProfileError) {
        console.warn('Custom profiles not accessible (RLS):', customProfileError)
      }

      // Función para obtener nombre a mostrar
      const getDisplayName = (userId) => {
        const customProfile = customProfiles?.find(p => p.id === userId)
        if (customProfile?.display_name) {
          return customProfile.display_name
        }
        
        const adminProfile = adminProfiles?.find(p => p.user_id === userId)
        
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
        
        if (adminProfile?.full_name) {
          const firstName = adminProfile.full_name.split(' ')[0]
          if (firstName?.trim()) return firstName.trim()
        }
        
        if (adminProfile?.email) {
          return adminProfile.email.split('@')[0]
        }
        
        return 'Usuario anónimo'
      }

      // Combinar datos con nombres
      const finalStreakRanking = filteredStreaks.map((streakUser, index) => {
        return {
          ...streakUser,
          rank: index + 1,
          name: getDisplayName(streakUser.userId),
          isCurrentUser: streakUser.userId === user?.id
        }
      })

      setStreakRanking(finalStreakRanking)
      
    } catch (error) {
      console.error('Error loading streak ranking:', error)
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

  // Función de cálculo de racha movida a utils/streakCalculator.js para evitar duplicación

  // Function to calculate consecutive days streak - ANTIGUA (ELIMINAR DESPUÉS)
  const calculateStreak = (activities) => {
    if (!activities || activities.length === 0) return 0

    // Group activities by day (using UTC to match database)
    const dayGroups = {}
    activities.forEach(activity => {
      const date = new Date(activity.created_at)
      const day = date.toISOString().split('T')[0] // YYYY-MM-DD format in UTC
      dayGroups[day] = true
    })

    const uniqueDays = Object.keys(dayGroups).sort((a, b) => b.localeCompare(a)) // Sort descending
    
    if (uniqueDays.length === 0) return 0
    
    let streak = 0
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // DEBUG: Log for testing
    console.log('🔍 DEBUG calculateStreak:', { todayStr, yesterdayStr, uniqueDays: uniqueDays.slice(0, 5) })
    
    // Find starting point: either today or yesterday
    let startDate
    if (uniqueDays.includes(todayStr)) {
      startDate = todayStr
    } else if (uniqueDays.includes(yesterdayStr)) {
      startDate = yesterdayStr
    } else {
      console.log('🔍 DEBUG: No recent activity', { todayStr, yesterdayStr, firstActivity: uniqueDays[0] })
      return 0 // No recent activity
    }
    
    // Count consecutive days backwards from start date
    let checkDate = new Date(startDate + 'T00:00:00Z')
    
    for (let i = 0; i < 30; i++) {
      const checkDateStr = checkDate.toISOString().split('T')[0]
      
      if (uniqueDays.includes(checkDateStr)) {
        streak++
        checkDate.setUTCDate(checkDate.getUTCDate() - 1) // Go back one day
      } else {
        break // End streak on first missing day
      }
    }
    
    console.log('🔍 DEBUG final streak:', { startDate, streak, totalDays: uniqueDays.length })
    return streak
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
          {/* Tabs */}
          <div className="flex justify-center space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('ranking')}
              data-tab="ranking"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'ranking'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🏆 Ranking
            </button>
            <button
              onClick={() => setActiveTab('rachas')}
              data-tab="rachas"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'rachas'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🔥 Rachas
            </button>
          </div>

          {/* Filtros de tiempo - solo en tab ranking */}
          {activeTab === 'ranking' && (
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
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando {activeTab === 'ranking' ? 'ranking' : 'rachas'}...</p>
            </div>
          ) : (
            <>
              {activeTab === 'ranking' ? (
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
              ) : (
                /* Tab Rachas */
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-800 mb-2 text-center">
                    🔥 Top Rachas (últimos 30 días)
                  </h3>
                  <p className="text-xs text-gray-400 text-center mb-4">
                    * Permitido 1 día de gracia sin actividad para conservar la racha
                  </p>
                  
                  {streakRanking.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">🔥</div>
                      <p className="text-gray-600">¡Nadie tiene racha activa!</p>
                      <p className="text-sm text-gray-500">Estudia varios días seguidos para aparecer aquí</p>
                    </div>
                  ) : (
                    streakRanking.map((user) => (
                      <div
                        key={user.userId}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                          user.isCurrentUser 
                            ? 'bg-orange-50 border border-orange-200' 
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg ${
                            user.rank === 1 ? 'text-yellow-600' : 
                            user.rank === 2 ? 'text-gray-500' : 
                            user.rank === 3 ? 'text-amber-600' : 'text-gray-400'
                          }`}>
                            {user.rank <= 3 ? getRankIcon(user.rank) : `#${user.rank}`}
                          </div>
                          <div>
                            <p className={`font-medium ${user.isCurrentUser ? 'text-orange-700' : 'text-gray-800'}`}>
                              {user.name}
                              {user.isCurrentUser && <span className="ml-1 text-orange-600 text-sm">(Tú)</span>}
                            </p>
                            <p className="text-xs text-gray-500">
                              Días consecutivos estudiando
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="font-bold text-orange-600 text-xl">
                            🔥 {user.streak > 30 ? '30+' : user.streak}
                          </div>
                          <div className="text-xs text-gray-400">días seguidos</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
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