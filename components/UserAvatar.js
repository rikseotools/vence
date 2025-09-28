// components/UserAvatar.js - FIXED VERSION using useAuth context
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext' // Using context instead of local instance

export default function UserAvatar() {
  // Using Auth context instead of local state
  const { user, loading: authLoading, signOut, supabase } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [userStats, setUserStats] = useState({
    streak: 0,
    accuracy: 0,
    weeklyQuestions: 0,
    totalQuestions: 0,
    userRegisteredDate: new Date()
  })
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    // Only load stats if user is available and not loading
    if (user && !authLoading && !statsLoading && supabase) {
      loadUserStats(user.id)
    } else if (!authLoading && !user) {
      setUserStats({
        streak: 0,
        accuracy: 0,
        weeklyQuestions: 0,
        totalQuestions: 0,
        userRegisteredDate: new Date()
      })
    }
  }, [user, authLoading, supabase]) // Context dependencies

  // Load user statistics
  const loadUserStats = async (userId) => {
    if (statsLoading) return // Prevenir cargas concurrentes
    
    try {
      setStatsLoading(true)
      
      // Verify we have the user before proceeding
      if (!user || !user.created_at) {
        return
      }

      // Get user registration date
      const userCreatedAt = new Date(user.created_at)
      
      // Calcular lunes de esta semana (igual que en estadísticas)
      const now = new Date()
      const dayOfWeek = now.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // domingo = 0, lunes = 1
      const mondayThisWeek = new Date(now)
      mondayThisWeek.setDate(now.getDate() - daysToMonday)
      mondayThisWeek.setHours(0, 0, 0, 0)


      // 1. Get user's test IDs first
      const { data: userTests, error: userTestsError } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', userId)

      if (userTestsError) {
        console.warn('Error loading user tests:', userTestsError)
        return
      }

      if (!userTests || userTests.length === 0) {
        setUserStats({
          streak: 0,
          accuracy: 0,
          weeklyQuestions: 0,
          totalQuestions: 0,
          userRegisteredDate: userCreatedAt
        })
        return
      }

      // Obtener IDs de tests del usuario para las consultas de conteo
      const testIds = userTests.map(test => test.id)

      // 2. ⚡ OPTIMIZADO: Contar preguntas desde lunes de esta semana usando test_id IN
      const { count: weeklyQuestions, error: weeklyError } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', mondayThisWeek.toISOString())
        .in('test_id', testIds)

      if (weeklyError) {
        console.warn('Error loading weekly questions:', weeklyError)
      }

      // 3. ⚡ OPTIMIZADO: Contar TODAS las preguntas usando test_id IN
      const { count: totalQuestions, error: totalError } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .in('test_id', testIds)

      // 4. ⚡ OPTIMIZADO: Contar solo preguntas correctas usando test_id IN
      const { count: correctAnswers, error: correctError } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .in('test_id', testIds)
        .eq('is_correct', true)

      if (totalError || correctError) {
        console.warn('Error loading question counts:', totalError || correctError)
      }

      // 5. Calculate streak (consecutive days with activity) - USING test_questions
      const { data: recentActivity, error: activityError } = await supabase
        .from('test_questions')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .in('test_id', testIds)
        .order('created_at', { ascending: false })

      if (activityError) {
        console.warn('Error loading recent activity:', activityError)
      }

      // Calculate consecutive days streak
      const streak = calculateStreak(recentActivity || [])

      // ⚡ Calculate accuracy from count queries (OPTIMIZED)
      const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0


      setUserStats({
        streak: streak,
        accuracy: accuracy,
        weeklyQuestions: weeklyQuestions || 0,
        totalQuestions: totalQuestions || 0,
        userRegisteredDate: userCreatedAt
      })
    } catch (error) {
      console.warn('Error loading stats:', error)
      setUserStats({
        streak: 0,
        accuracy: 0,
        weeklyQuestions: 0,
        totalQuestions: 0,
        userRegisteredDate: user?.created_at ? new Date(user.created_at) : new Date()
      })
    } finally {
      setStatsLoading(false)
    }
  }

  // Function to calculate consecutive days streak
  const calculateStreak = (activities) => {
    if (!activities || activities.length === 0) return 0

    // Group activities by day
    const dayGroups = {}
    activities.forEach(activity => {
      const day = new Date(activity.created_at).toDateString()
      dayGroups[day] = true
    })

    const uniqueDays = Object.keys(dayGroups).sort((a, b) => new Date(b) - new Date(a))
    
    let streak = 0
    let currentDate = new Date()
    
    // Check consecutive days from today backwards
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(currentDate)
      checkDate.setDate(checkDate.getDate() - i)
      const checkDateString = checkDate.toDateString()
      
      if (uniqueDays.includes(checkDateString)) {
        streak++
      } else if (i > 0) {
        // If no activity today, but there was yesterday, start from yesterday
        break
      }
    }
    
    return streak
  }

  const handleSignOut = () => {
    setShowDropdown(false)
    signOut()
  }

  const handleLinkClick = () => {
    setShowDropdown(false)
  }

  // Get avatar (priority: custom > Google > initial)
  const getAvatarDisplay = () => {
    // 1. Custom avatar (icons from AvatarChanger)
    if (user?.user_metadata?.avatar_type === 'predefined' && user?.user_metadata?.avatar_emoji) {
      return {
        type: 'custom',
        element: (
          <div className={`w-10 h-10 bg-gradient-to-r ${user.user_metadata.avatar_color} rounded-full flex items-center justify-center text-white text-xl border-2 border-green-500`}>
            {user.user_metadata.avatar_emoji}
          </div>
        ),
        elementLarge: (
          <div className={`w-12 h-12 bg-gradient-to-r ${user.user_metadata.avatar_color} rounded-full flex items-center justify-center text-white text-2xl`}>
            {user.user_metadata.avatar_emoji}
          </div>
        )
      }
    }

    // 2. Google/provider photo (if available)
    if (user?.user_metadata?.avatar_url || user?.user_metadata?.picture) {
      const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture
      return {
        type: 'photo',
        element: (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-10 h-10 rounded-full border-2 border-green-500 object-cover"
            onError={(e) => {
              // If image fails, show initial
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
        ),
        elementLarge: (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-12 h-12 rounded-full object-cover"
          />
        ),
        fallback: true
      }
    }

    // 3. Name/email initial
    const initial = user?.user_metadata?.full_name?.charAt(0).toUpperCase() || 
                   user?.email?.charAt(0).toUpperCase() || 'U'
    
    return {
      type: 'initial',
      element: (
        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-green-500">
          {initial}
        </div>
      ),
      elementLarge: (
        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
          {initial}
        </div>
      )
    }
  }

  // Get display name
  const getDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
    }
    return user?.email || 'Usuario'
  }

  // If loading, show skeleton
  if (authLoading) {
    return (
      <div className="animate-pulse">
        <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
      </div>
    )
  }

  // If no user, show login button
  if (!user) {
    return (
      <Link 
        href="/es/login"
        className="bg-gradient-to-r from-green-700 to-green-800 text-white px-4 py-2 rounded-lg hover:from-green-800 hover:to-green-900 transition-all duration-200 font-medium text-sm"
      >
        Iniciar Sesión
      </Link>
    )
  }

  const avatarDisplay = getAvatarDisplay()

  return (
    <div className="relative">
      {/* Clickable Avatar */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {/* Avatar with fallback for photos */}
        <div className="relative">
          {avatarDisplay.element}
          {avatarDisplay.fallback && (
            <div 
              className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-green-500"
              style={{ display: 'none' }}
            >
              {user?.user_metadata?.full_name?.charAt(0).toUpperCase() || 
               user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          
          {/* Online indicator */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
        </div>

        {/* Name (optional, only on large screens) */}
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-gray-900">
            {getDisplayName()}
          </div>
          <div className="text-xs text-green-600">✅ Registrado</div>
        </div>

        {/* Dropdown arrow */}
        <svg 
          className={`w-4 h-4 text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <>
          {/* Overlay to close */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          ></div>
          
          {/* Dropdown menu */}
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            {/* User header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                {avatarDisplay.elementLarge}
                <div>
                  <div className="font-semibold text-gray-900">
                    {getDisplayName()}
                  </div>
                  <div className="text-sm text-gray-600">
                    {user.email}
                  </div>
                  {/* Avatar type */}
                  <div className="text-xs text-gray-500">
                    {avatarDisplay.type === 'custom' && '🎨 Avatar personalizado'}
                    {avatarDisplay.type === 'photo' && '📸 Foto de perfil'}
                    {avatarDisplay.type === 'initial' && '🔤 Avatar inicial'}
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced stats with streak and accuracy */}
            <div className="p-4 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-3">📊 Tu Progreso</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Streak */}
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <div className="text-orange-600 text-xs mb-1">🔥 Racha</div>
                  <div className="font-bold text-orange-700 text-xl">{userStats.streak}</div>
                  <div className="text-orange-600 text-xs">días consecutivos</div>
                </div>
                
                {/* Success percentage */}
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-green-600 text-xs mb-1">🎯 Precisión</div>
                  <div className="font-bold text-green-700 text-xl">{userStats.accuracy}%</div>
                  <div className="text-green-600 text-xs">de aciertos</div>
                </div>
                
                {/* Questions this week */}
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="text-blue-600 text-xs mb-1">📝 Esta semana</div>
                  <div className="font-bold text-blue-700 text-xl">{userStats.weeklyQuestions}</div>
                  <div className="text-blue-600 text-xs">preguntas hechas</div>
                </div>
                
                {/* Questions since registration */}
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <div className="text-purple-600 text-xs mb-1">📚 Total preguntas hechas</div>
                  <div className="font-bold text-purple-700 text-xl">{userStats.totalQuestions}</div>
                  <div className="text-purple-600 text-xs">
                    desde {userStats.userRegisteredDate.toLocaleDateString('es-ES', { 
                      day: 'numeric', 
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu options */}
            <div className="p-2">
              <Link
                href="/es/perfil"
                onClick={handleLinkClick}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center space-x-3 block"
              >
                <span>👤</span>
                <span>Mi Perfil</span>
                <span className="ml-auto text-xs text-gray-400">Cambiar avatar</span>
              </Link>
              
              <Link
                href="/es/mis-estadisticas"
                onClick={handleLinkClick}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center space-x-3 block"
              >
                <span>📊</span>
                <span>Mis Estadísticas</span>
                <span className="ml-auto text-xs text-gray-400">Completas</span>
              </Link>
              
              <hr className="my-2" />
              
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center space-x-3"
              >
                <span>🚪</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}