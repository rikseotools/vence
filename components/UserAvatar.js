// components/UserAvatar.js - FIXED VERSION using useAuth context
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext' // Using context instead of local instance
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
// import { calculateUserStreak } from '@/utils/streakCalculator' // 🚫 YA NO NECESARIO

export default function UserAvatar() {
  // Using Auth context instead of local state
  const { user, loading: authLoading, signOut, supabase } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const adminNotifications = useAdminNotifications()
  const [userStats, setUserStats] = useState({
    streak: 0,
    accuracy: 0,
    weeklyQuestions: 0,
    totalQuestions: 0,
    userRegisteredDate: new Date()
  })
  const [statsLoading, setStatsLoading] = useState(false)
  // 🆕 Estado para exámenes pendientes
  const [pendingExams, setPendingExams] = useState([])
  const [pendingExamsExpanded, setPendingExamsExpanded] = useState(false)

  // 🆕 Cargar exámenes pendientes cuando se abre el dropdown
  useEffect(() => {
    if (showDropdown && user?.id) {
      loadPendingExams()
    }
    // Reset expanded state when dropdown closes
    if (!showDropdown) {
      setPendingExamsExpanded(false)
    }
  }, [showDropdown, user?.id])

  async function loadPendingExams() {
    try {
      const response = await fetch(`/api/exam/pending?userId=${user.id}&testType=exam&limit=10`)
      const data = await response.json()
      if (data.success) {
        setPendingExams(data.exams || [])
      }
    } catch (err) {
      console.error('Error cargando exámenes pendientes:', err)
      setPendingExams([])
    }
  }

  const pendingExamsCount = pendingExams.length

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

  // Verificar si es admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!user || !supabase) {
        setIsAdmin(false)
        setAdminLoading(false)
        return
      }

      try {
        const { data, error } = await supabase.rpc('is_current_user_admin')

        if (error) {
          console.error('Error verificando admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(data === true)
        }
      } catch (err) {
        console.error('Error en verificación de admin:', err)
        setIsAdmin(false)
      } finally {
        setAdminLoading(false)
      }
    }

    if (!authLoading) {
      checkAdminStatus()
    }
  }, [user, supabase, authLoading])

  // Load user statistics using RPC function
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

      console.log('🔍 UserAvatar: Loading stats for userId:', userId)

      // Usar función RPC que consolida todas las fuentes de datos
      const { data: rpcStats, error: rpcError } = await supabase.rpc('get_user_public_stats', {
        p_user_id: userId
      })

      console.log('🔍 UserAvatar: RPC Response:', { rpcStats, rpcError })

      if (rpcError) {
        console.error('❌ UserAvatar: Error loading user stats from RPC:', rpcError)
        setUserStats({
          streak: 0,
          accuracy: 0,
          weeklyQuestions: 0,
          totalQuestions: 0,
          userRegisteredDate: userCreatedAt
        })
        return
      }

      const stats = rpcStats?.[0] || {}
      console.log('🔍 UserAvatar: Stats object:', stats)

      // Usar questions_this_week si está disponible (nueva RPC), si no usar today_questions como fallback
      const weeklyQuestions = stats.questions_this_week || stats.today_questions || 0

      console.log('🔍 UserAvatar: Calculated values:', {
        current_streak: stats.current_streak,
        global_accuracy: stats.global_accuracy,
        questions_this_week: stats.questions_this_week,
        today_questions: stats.today_questions,
        weeklyQuestions: weeklyQuestions,
        total_questions: stats.total_questions
      })

      setUserStats({
        streak: Number(stats.current_streak) || 0,
        accuracy: Number(stats.global_accuracy) || 0,
        weeklyQuestions: weeklyQuestions,
        totalQuestions: Number(stats.total_questions) || 0,
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

  // Función de cálculo de racha movida a utils/streakCalculator.js para evitar duplicación

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
        href="/login"
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
                <Link
                  href="/perfil"
                  className="relative group hover:opacity-80 transition-opacity cursor-pointer"
                  title="Cambiar avatar"
                  onClick={() => setShowDropdown(false)}
                >
                  {avatarDisplay.elementLarge}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-full transition-all flex items-center justify-center">
                    <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                  </div>
                </Link>
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
                  <div className="font-bold text-orange-700 text-xl">{userStats.streak > 30 ? '30+' : userStats.streak}</div>
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
                href="/perfil"
                onClick={handleLinkClick}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center space-x-3 block"
              >
                <span>👤</span>
                <span>Mi Perfil</span>
              </Link>

              <Link
                href="/mis-estadisticas"
                onClick={handleLinkClick}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center space-x-3 block"
              >
                <span>📊</span>
                <span>Mis Estadísticas</span>
              </Link>

              {/* 🆕 Exámenes pendientes - Expandible */}
              {pendingExamsCount > 0 && (
                <div>
                  <button
                    onClick={() => setPendingExamsExpanded(!pendingExamsExpanded)}
                    className="w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 rounded-lg flex items-center space-x-3"
                  >
                    <span>📝</span>
                    <span>Exámenes pendientes</span>
                    <span className="ml-auto flex items-center gap-1">
                      <span className="bg-amber-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                        {pendingExamsCount > 9 ? '9+' : pendingExamsCount}
                      </span>
                      <svg
                        className={`w-4 h-4 transition-transform ${pendingExamsExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  {/* Lista expandida de exámenes */}
                  {pendingExamsExpanded && (
                    <div className="ml-6 mt-1 space-y-1 border-l-2 border-amber-200 pl-3">
                      {pendingExams.map(exam => {
                        const progress = exam.totalQuestions > 0
                          ? Math.round((exam.answeredQuestions / exam.totalQuestions) * 100)
                          : 0
                        const resumeUrl = `/auxiliar-administrativo-estado/test/tema/${exam.temaNumber || 1}/test-examen?resume=${exam.id}`

                        return (
                          <Link
                            key={exam.id}
                            href={resumeUrl}
                            onClick={handleLinkClick}
                            className="block px-3 py-2 text-xs bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                          >
                            <div className="font-medium text-amber-800 truncate">
                              {exam.title || `Tema ${exam.temaNumber}`}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-amber-200 rounded-full h-1.5">
                                <div
                                  className="bg-amber-500 h-1.5 rounded-full"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-amber-600 font-medium">
                                {exam.answeredQuestions}/{exam.totalQuestions}
                              </span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <Link
                href="/soporte"
                onClick={handleLinkClick}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center space-x-3 block"
              >
                <span>💬</span>
                <span>Soporte</span>
              </Link>

              {/* Enlace Admin */}
              {isAdmin && !adminLoading && (
                <>
                  <hr className="my-2" />
                  <Link
                    href="/admin"
                    onClick={handleLinkClick}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center space-x-3 block relative"
                  >
                    <span>👨‍💼</span>
                    <span>Panel Admin</span>
                    {(adminNotifications?.feedback + adminNotifications?.impugnaciones) > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                        {(adminNotifications?.feedback + adminNotifications?.impugnaciones) > 9 ? '9+' : (adminNotifications?.feedback + adminNotifications?.impugnaciones)}
                      </span>
                    )}
                  </Link>
                </>
              )}

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