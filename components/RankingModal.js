'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import UserProfileModal from './UserProfileModal'
// import { calculateUserStreak } from '@/utils/streakCalculator' // 🚫 YA NO NECESARIO

export default function RankingModal({ isOpen, onClose }) {
  const { user, supabase } = useAuth()
  const [ranking, setRanking] = useState([])
  const [streakRanking, setStreakRanking] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [currentUserRank, setCurrentUserRank] = useState(null)
  const [timeFilter, setTimeFilter] = useState('week') // 'yesterday', 'today', 'week', 'month'
  const [streakTimeFilter, setStreakTimeFilter] = useState('week') // 'week', 'month', 'all'
  const [streakCategory, setStreakCategory] = useState('all') // 'all', 'novatos', 'veteranos'
  const [activeTab, setActiveTab] = useState('ranking') // 'ranking', 'rachas'

  useEffect(() => {
    if (isOpen && user && supabase) {
      if (activeTab === 'ranking') {
        loadRanking()
      } else if (activeTab === 'rachas') {
        loadStreakRanking()
      }
    }
  }, [isOpen, user, supabase, timeFilter, streakTimeFilter, streakCategory, activeTab])

  // Auto-seleccionar categoría del usuario al abrir tab de rachas
  useEffect(() => {
    const detectUserCategory = async () => {
      if (!isOpen || !user || !supabase || activeTab !== 'rachas') return

      // Obtener fecha de registro del usuario actual
      const { data: profile } = await supabase
        .from('public_user_profiles')
        .select('created_at')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.created_at) {
        const registrationDate = new Date(profile.created_at)
        const daysSinceRegistration = Math.floor((new Date() - registrationDate) / (1000 * 60 * 60 * 24))
        const userCategory = daysSinceRegistration < 30 ? 'principiantes' : 'veteranos'

        console.log('🎯 Usuario detectado como:', userCategory, '| Días en Vence:', daysSinceRegistration)
        setStreakCategory(userCategory)
      }
    }

    detectUserCategory()
  }, [isOpen, activeTab, user, supabase])

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
        // Esta semana - desde el lunes de esta semana
        console.log('🔍 Calculando fecha para "Esta semana"')
        const now = new Date()
        console.log('   Fecha actual:', now.toISOString())

        // Calcular el lunes de esta semana
        const dayOfWeek = now.getUTCDay() // 0 = domingo, 1 = lunes, etc.
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Domingo cuenta como 6 días desde el lunes
        const thisMonday = new Date(now)
        thisMonday.setUTCDate(now.getUTCDate() - daysFromMonday)
        thisMonday.setUTCHours(0, 0, 0, 0)

        startDate = thisMonday.toISOString()
        console.log('   Desde el lunes:', startDate)
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
        p_min_questions: 1,
        p_limit: 100
      })

      if (error) {
        console.error('Error loading ranking')
        return
      }

      // Obtener nombres de usuarios - todos los usuarios del ranking
      const topUsers = rankingData || []
      const userIds = topUsers.map(u => u.user_id)
      
      // Incluir usuario actual si no está en el ranking
      if (user && !userIds.includes(user.id)) {
        userIds.push(user.id)
      }

      // Obtener nombres y ciudades desde admin_users_with_roles (sin RLS)
      const { data: adminProfiles, error: adminProfilesError } = await supabase
        .from('admin_users_with_roles')
        .select('user_id, full_name, email')
        .in('user_id', userIds)

      if (adminProfilesError) {
        console.error('Error loading admin user profiles')
      }

      // También intentar obtener display_names, ciudades y avatares desde public_user_profiles
      const { data: customProfiles, error: customProfileError } = await supabase
        .from('public_user_profiles')
        .select('id, display_name, ciudad, avatar_type, avatar_emoji, avatar_color, avatar_url')
        .in('id', userIds)

      // Obtener avatares automáticos desde user_avatar_settings
      const { data: avatarSettings } = await supabase
        .from('user_avatar_settings')
        .select('user_id, mode, current_emoji, current_profile')
        .in('user_id', userIds)

      // Función para obtener ciudad del usuario desde public_user_profiles
      const getUserCity = (userId) => {
        const userProfile = customProfiles?.find(p => p.id === userId)
        return userProfile?.ciudad || null
      }

      // Función para obtener avatar del usuario
      const getUserAvatar = (userId) => {
        // 1. Primero verificar si tiene avatar automático asignado
        const autoAvatar = avatarSettings?.find(a => a.user_id === userId)
        if (autoAvatar?.current_emoji) {
          return {
            type: 'automatic',
            emoji: autoAvatar.current_emoji,
            profile: autoAvatar.current_profile
          }
        }

        // 2. Verificar perfil público (avatar manual)
        const userProfile = customProfiles?.find(p => p.id === userId)

        if (!userProfile) {
          // Si es el usuario actual, usar datos del contexto
          if (userId === user?.id && user?.user_metadata) {
            const meta = user.user_metadata
            if (meta.avatar_type === 'predefined' && meta.avatar_emoji) {
              return {
                type: 'predefined',
                emoji: meta.avatar_emoji,
                color: meta.avatar_color
              }
            }
            if (meta.avatar_type === 'uploaded' && meta.avatar_url) {
              return {
                type: 'uploaded',
                url: meta.avatar_url
              }
            }
            if (meta.avatar_url || meta.picture) {
              return {
                type: 'google',
                url: meta.avatar_url || meta.picture
              }
            }
          }
          return null
        }

        // Usar datos del perfil público
        if (userProfile.avatar_type === 'predefined' && userProfile.avatar_emoji) {
          return {
            type: 'predefined',
            emoji: userProfile.avatar_emoji,
            color: userProfile.avatar_color
          }
        }
        if (userProfile.avatar_type === 'uploaded' && userProfile.avatar_url) {
          return {
            type: 'uploaded',
            url: userProfile.avatar_url
          }
        }
        return null
      }

      // Función para obtener nombre a mostrar
      const getDisplayName = (userId) => {
        // 1. Buscar display_name personalizado (pero ignorar si es "Usuario")
        const customProfile = customProfiles?.find(p => p.id === userId)
        if (customProfile?.display_name && customProfile.display_name !== 'Usuario') {
          return customProfile.display_name
        }

        // 2. Buscar en admin_users_with_roles
        const adminProfile = adminProfiles?.find(p => p.user_id === userId)

        // 3. Si es el usuario actual y no hay perfil, usar datos del contexto
        if (userId === user?.id) {
          if (user?.user_metadata?.full_name && user.user_metadata.full_name !== 'Usuario') {
            const firstName = user.user_metadata.full_name.split(' ')[0]
            if (firstName?.trim() && firstName !== 'Usuario') return firstName.trim()
          }
          if (user?.email) {
            return user.email.split('@')[0]
          }
          return 'Tú'
        }

        // 4. Para otros usuarios, usar primer nombre del admin profile (si no es genérico)
        if (adminProfile?.full_name && adminProfile.full_name !== 'Usuario') {
          const firstName = adminProfile.full_name.split(' ')[0]
          if (firstName?.trim() && firstName !== 'Usuario') return firstName.trim()
        }

        // 5. Fallback a email sin dominio del admin profile
        if (adminProfile?.email) {
          const emailName = adminProfile.email.split('@')[0]
          // Limpiar números y caracteres especiales del email para que sea más legible
          const cleanName = emailName.replace(/[0-9]+/g, '').replace(/[._-]/g, ' ').trim()
          if (cleanName) {
            // Capitalizar primera letra
            return cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
          }
          return emailName
        }

        // 6. Último recurso: nombre genérico sin números
        return 'Anónimo'
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
          ciudad: getUserCity(stats.user_id),
          avatar: getUserAvatar(stats.user_id),
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
          console.error('Error getting user position')
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
            ciudad: getUserCity(user.id),
            avatar: getUserAvatar(user.id),
            isCurrentUser: true
          })
        } else {
          // Usuario no califica para el ranking (< 1 pregunta)
          setCurrentUserRank(null)
        }
      } else {
        // No hay usuario logueado
        setCurrentUserRank(null)
      }

    } catch (error) {
      console.error('Error loading ranking')
    } finally {
      setLoading(false)
    }
  }

  const loadStreakRanking = async () => {
    setLoading(true)
    setStreakRanking([]) // Limpiar estado anterior
    try {
      console.log('🔥 RankingModal: Cargando ranking de rachas...', { filter: streakTimeFilter })

      let streakData = []
      let error = null

      if (streakTimeFilter === 'week') {
        // 🗓️ ESTA SEMANA: Días de actividad esta semana (lunes a domingo)
        const now = new Date()
        const dayOfWeek = now.getUTCDay() // 0 = domingo
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        const thisMonday = new Date(now)
        thisMonday.setUTCDate(now.getUTCDate() - daysFromMonday)
        thisMonday.setUTCHours(0, 0, 0, 0)
        const maxDaysThisWeek = daysFromMonday + 1 // Máximo posible esta semana

        console.log('🗓️ Esta semana desde:', thisMonday.toISOString().split('T')[0], '| Max días:', maxDaysThisWeek)

        const { data, error: queryError } = await supabase
          .from('user_streaks')
          .select('user_id, current_streak')
          .gte('last_activity_date', thisMonday.toISOString().split('T')[0])
          .gte('current_streak', 2)
          .order('current_streak', { ascending: false })

        streakData = (data || []).map(d => ({
          user_id: d.user_id,
          streak: Math.min(d.current_streak, maxDaysThisWeek)
        }))
        error = queryError
      } else if (streakTimeFilter === 'month') {
        // 📅 ESTE MES: Días de actividad este mes
        const now = new Date()
        const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        const dayOfMonth = now.getUTCDate() // Día del mes actual
        const maxDaysThisMonth = dayOfMonth // Máximo posible este mes

        console.log('📅 Este mes desde:', firstDayOfMonth.toISOString().split('T')[0], '| Max días:', maxDaysThisMonth)

        const { data, error: queryError } = await supabase
          .from('user_streaks')
          .select('user_id, current_streak')
          .gte('last_activity_date', firstDayOfMonth.toISOString().split('T')[0])
          .gte('current_streak', 2)
          .order('current_streak', { ascending: false })

        streakData = (data || []).map(d => ({
          user_id: d.user_id,
          streak: Math.min(d.current_streak, maxDaysThisMonth)
        }))
        error = queryError
      } else {
        // 📊 ACUMULADO: Usar rachas totales desde user_streaks
        // Solo mostrar usuarios con actividad en últimos 2 días (racha activa real)
        const twoDaysAgo = new Date()
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0]

        const { data, error: queryError } = await supabase
          .from('user_streaks')
          .select('user_id, current_streak')
          .gte('current_streak', 2)
          .gte('last_activity_date', twoDaysAgoStr)
          .order('current_streak', { ascending: false })

        streakData = (data || []).map(d => ({
          user_id: d.user_id,
          streak: d.current_streak
        }))
        error = queryError
      }

      if (error) {
        console.error('Error loading streak ranking')
        return
      }


      // Transformar datos al formato esperado (ya viene con user_id y streak)
      const filteredStreaks = streakData?.map(item => ({
        userId: item.user_id,
        streak: item.streak
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
        console.error('Error loading admin user profiles')
      }

      const { data: customProfiles, error: customProfileError } = await supabase
        .from('public_user_profiles')
        .select('id, display_name, ciudad, avatar_type, avatar_emoji, avatar_color, avatar_url, created_at')
        .in('id', userIds)

      // Obtener avatares automáticos desde user_avatar_settings
      const { data: avatarSettings } = await supabase
        .from('user_avatar_settings')
        .select('user_id, mode, current_emoji, current_profile')
        .in('user_id', userIds)

      // Función para verificar si es principiante (< 30 días en Vence)
      const isNovato = (userId) => {
        const profile = customProfiles?.find(p => p.id === userId)
        if (!profile?.created_at) return false
        const registrationDate = new Date(profile.created_at)
        const daysSinceRegistration = Math.floor((new Date() - registrationDate) / (1000 * 60 * 60 * 24))
        return daysSinceRegistration < 30
      }

      // Función para obtener ciudad del usuario desde public_user_profiles
      const getUserCity = (userId) => {
        const userProfile = customProfiles?.find(p => p.id === userId)
        return userProfile?.ciudad || null
      }

      // Función para obtener avatar del usuario
      const getUserAvatar = (userId) => {
        // 1. Primero verificar si tiene avatar automático asignado
        const autoAvatar = avatarSettings?.find(a => a.user_id === userId)
        if (autoAvatar?.current_emoji) {
          return {
            type: 'automatic',
            emoji: autoAvatar.current_emoji,
            profile: autoAvatar.current_profile
          }
        }

        // 2. Verificar perfil público (avatar manual)
        const userProfile = customProfiles?.find(p => p.id === userId)

        if (!userProfile) {
          // Si es el usuario actual, usar datos del contexto
          if (userId === user?.id && user?.user_metadata) {
            const meta = user.user_metadata
            if (meta.avatar_type === 'predefined' && meta.avatar_emoji) {
              return {
                type: 'predefined',
                emoji: meta.avatar_emoji,
                color: meta.avatar_color
              }
            }
            if (meta.avatar_type === 'uploaded' && meta.avatar_url) {
              return {
                type: 'uploaded',
                url: meta.avatar_url
              }
            }
            if (meta.avatar_url || meta.picture) {
              return {
                type: 'google',
                url: meta.avatar_url || meta.picture
              }
            }
          }
          return null
        }

        // Usar datos del perfil público
        if (userProfile.avatar_type === 'predefined' && userProfile.avatar_emoji) {
          return {
            type: 'predefined',
            emoji: userProfile.avatar_emoji,
            color: userProfile.avatar_color
          }
        }
        if (userProfile.avatar_type === 'uploaded' && userProfile.avatar_url) {
          return {
            type: 'uploaded',
            url: userProfile.avatar_url
          }
        }
        return null
      }

      // Función para obtener nombre a mostrar (igual que en ranking general)
      const getDisplayName = (userId) => {
        // 1. Buscar display_name personalizado (pero ignorar si es "Usuario")
        const customProfile = customProfiles?.find(p => p.id === userId)
        if (customProfile?.display_name && customProfile.display_name !== 'Usuario') {
          return customProfile.display_name
        }

        // 2. Buscar en admin_users_with_roles
        const adminProfile = adminProfiles?.find(p => p.user_id === userId)

        // 3. Si es el usuario actual y no hay perfil, usar datos del contexto
        if (userId === user?.id) {
          if (user?.user_metadata?.full_name && user.user_metadata.full_name !== 'Usuario') {
            const firstName = user.user_metadata.full_name.split(' ')[0]
            if (firstName?.trim() && firstName !== 'Usuario') return firstName.trim()
          }
          if (user?.email) {
            return user.email.split('@')[0]
          }
          return 'Tú'
        }

        // 4. Para otros usuarios, usar primer nombre del admin profile (si no es genérico)
        if (adminProfile?.full_name && adminProfile.full_name !== 'Usuario') {
          const firstName = adminProfile.full_name.split(' ')[0]
          if (firstName?.trim() && firstName !== 'Usuario') return firstName.trim()
        }

        // 5. Fallback a email sin dominio del admin profile
        if (adminProfile?.email) {
          const emailName = adminProfile.email.split('@')[0]
          // Limpiar números y caracteres especiales del email para que sea más legible
          const cleanName = emailName.replace(/[0-9]+/g, '').replace(/[._-]/g, ' ').trim()
          if (cleanName) {
            // Capitalizar primera letra
            return cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
          }
          return emailName
        }

        // 6. Último recurso: nombre genérico sin números
        return 'Anónimo'
      }

      // Filtrar por categoría (principiantes/veteranos)
      let filteredByCategory = filteredStreaks
      if (streakCategory === 'principiantes') {
        filteredByCategory = filteredStreaks.filter(u => isNovato(u.userId))
      } else if (streakCategory === 'veteranos') {
        filteredByCategory = filteredStreaks.filter(u => !isNovato(u.userId))
      }

      // Combinar datos con nombres
      const finalStreakRanking = filteredByCategory.map((streakUser, index) => {
        return {
          ...streakUser,
          rank: index + 1,
          name: getDisplayName(streakUser.userId),
          ciudad: getUserCity(streakUser.userId),
          avatar: getUserAvatar(streakUser.userId),
          isCurrentUser: streakUser.userId === user?.id,
          isNovato: isNovato(streakUser.userId)
        }
      })

      console.log('🔥 RankingModal: Ranking final de rachas:', finalStreakRanking.length, '| Categoría:', streakCategory)

      setStreakRanking(finalStreakRanking)
      
    } catch (error) {
      console.error('Error loading streak ranking')
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

  const renderAvatar = (avatar, name) => {
    if (!avatar) {
      // Avatar por defecto con inicial
      const initial = name?.charAt(0).toUpperCase() || 'U'
      return (
        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {initial}
        </div>
      )
    }

    if (avatar.type === 'automatic') {
      return (
        <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-lg">
          {avatar.emoji}
        </div>
      )
    }

    if (avatar.type === 'predefined') {
      return (
        <div className={`w-8 h-8 bg-gradient-to-r ${avatar.color} rounded-full flex items-center justify-center text-white text-base`}>
          {avatar.emoji}
        </div>
      )
    }

    if (avatar.type === 'uploaded' || avatar.type === 'google') {
      return (
        <img
          src={avatar.url}
          alt={name}
          className="w-8 h-8 rounded-full object-cover"
          onError={(e) => {
            // Si falla la imagen, mostrar inicial
            e.target.style.display = 'none'
            const initial = name?.charAt(0).toUpperCase() || 'U'
            const fallback = document.createElement('div')
            fallback.className = 'w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm'
            fallback.textContent = initial
            e.target.parentNode.replaceChild(fallback, e.target)
          }}
        />
      )
    }

    // Fallback por defecto
    const initial = name?.charAt(0).toUpperCase() || 'U'
    return (
      <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
        {initial}
      </div>
    )
  }

  const handleUserClick = (userInfo) => {
    // Ahora sí permitimos abrir el perfil propio
    setSelectedUser({
      userId: userInfo.userId,
      userName: userInfo.name
    })
    setShowProfileModal(true)
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
                          {renderAvatar(currentUserRank.avatar, currentUserRank.name)}
                          <div>
                            <p className="font-bold text-blue-700">
                              Tu posición: #{currentUserRank.rank}
                              {currentUserRank.ciudad && <span className="text-gray-500 text-sm ml-1">• {currentUserRank.ciudad}</span>}
                            </p>
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
                        <p className="text-sm text-gray-500">Responde al menos 1 pregunta para aparecer</p>
                      </div>
                    ) : (
                      console.log(`🎨 RENDERIZANDO ${activeTab} - ${timeFilter}: ${ranking.length} usuarios`) ||
                      ranking.map((user) => (
                        <div
                          key={user.userId}
                          onClick={() => handleUserClick(user)}
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                            user.isCurrentUser
                              ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg ${getRankColor(user.rank)}`}>
                              {user.rank <= 3 ? getRankIcon(user.rank) : `#${user.rank}`}
                            </div>
                            {renderAvatar(user.avatar, user.name)}
                            <div>
                              <p className={`font-medium ${user.isCurrentUser ? 'text-blue-700' : 'text-gray-800'}`}>
                                {user.name}
                                {user.ciudad && <span className="text-gray-500 text-sm ml-1">• {user.ciudad}</span>}
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
                  {/* Filtros de tiempo para rachas */}
                  <div className="flex justify-center space-x-2 mb-2">
                    <button
                      onClick={() => setStreakTimeFilter('week')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        streakTimeFilter === 'week'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Esta semana
                    </button>
                    <button
                      onClick={() => setStreakTimeFilter('month')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        streakTimeFilter === 'month'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {new Date().toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleString('es-ES', { month: 'long' }).slice(1)}
                    </button>
                    <button
                      onClick={() => setStreakTimeFilter('all')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        streakTimeFilter === 'all'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Acumulado
                    </button>
                  </div>

                  {/* Filtros de categoría (Principiantes/Veteranos) */}
                  <div className="flex justify-center space-x-2 mb-4">
                    <button
                      onClick={() => setStreakCategory('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        streakCategory === 'all'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setStreakCategory('principiantes')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        streakCategory === 'principiantes'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      🌱 Principiantes
                    </button>
                    <button
                      onClick={() => setStreakCategory('veteranos')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        streakCategory === 'veteranos'
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      ⭐ Veteranos
                    </button>
                  </div>

                  <h3 className="font-bold text-gray-800 dark:text-white mb-2 text-center">
                    🔥 {streakTimeFilter === 'week'
                      ? 'Rachas de la Semana'
                      : streakTimeFilter === 'month'
                        ? `Rachas de ${new Date().toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleString('es-ES', { month: 'long' }).slice(1)}`
                        : 'Top Rachas (Acumulado)'}
                    {streakCategory !== 'all' && (
                      <span className={`ml-2 text-sm ${streakCategory === 'principiantes' ? 'text-green-600' : 'text-amber-600'}`}>
                        ({streakCategory === 'principiantes' ? '🌱 Principiantes' : '⭐ Veteranos'})
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400 text-center mb-4">
                    {streakCategory === 'principiantes' && '🌱 Usuarios con menos de 30 días en Vence • '}
                    {streakCategory === 'veteranos' && '⭐ Usuarios con más de 30 días en Vence • '}
                    {streakTimeFilter === 'week'
                      ? 'Días de estudio esta semana'
                      : streakTimeFilter === 'month'
                        ? 'Días de estudio este mes'
                        : 'Días consecutivos de estudio'
                    }
                    <br />
                    Sin días de gracia: si un día no estudias, perderás la racha
                  </p>

                  {streakRanking.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">{streakCategory === 'principiantes' ? '🌱' : streakCategory === 'veteranos' ? '⭐' : '🔥'}</div>
                      <p className="text-gray-600">
                        {streakCategory === 'principiantes'
                          ? '¡No hay principiantes con racha activa!'
                          : streakCategory === 'veteranos'
                            ? '¡No hay veteranos con racha activa!'
                            : '¡Nadie tiene racha activa!'}
                      </p>
                      <p className="text-sm text-gray-500">Estudia varios días seguidos para aparecer aquí</p>
                    </div>
                  ) : (
                    streakRanking.map((user) => (
                      <div
                        key={user.userId}
                        onClick={() => handleUserClick(user)}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                          user.isCurrentUser
                            ? 'bg-orange-50 border border-orange-200 hover:bg-orange-100'
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
                          {renderAvatar(user.avatar, user.name)}
                          <div>
                            <p className={`font-medium ${user.isCurrentUser ? 'text-orange-700' : 'text-gray-800'}`}>
                              {user.name}
                              {user.ciudad && <span className="text-gray-500 text-sm ml-1">• {user.ciudad}</span>}
                              {user.isCurrentUser && <span className="ml-1 text-orange-600 text-sm">(Tú)</span>}
                            </p>
                            <p className="text-xs text-gray-500">
                              {streakTimeFilter === 'week'
                                ? 'Días activos esta semana'
                                : streakTimeFilter === 'month'
                                  ? 'Días activos este mes'
                                  : 'Días consecutivos estudiando'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-orange-600 text-xl">
                            🔥 {user.streak}
                          </div>
                          <div className="text-xs text-gray-400">
                            {streakTimeFilter === 'all' ? 'días seguidos' : 'días'}
                          </div>
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
              Mínimo 1 pregunta para aparecer en el ranking
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* Modal de perfil de usuario */}
      {selectedUser && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => {
            setShowProfileModal(false)
            setSelectedUser(null)
          }}
          userId={selectedUser.userId}
          userName={selectedUser.userName}
        />
      )}
    </div>
  )
}