// components/UserAvatar.tsx - Typed version with reliability fixes
'use client'
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { useSentryIssues } from '@/hooks/useSentryIssues'

// ── Types ────────────────────────────────────────────────────────

interface UserStats {
  streak: number
  accuracy: number
  weeklyQuestions: number
  totalQuestions: number
  userRegisteredDate: Date
}

interface PendingExam {
  id: string
  title?: string
  temaNumber?: number
  answeredQuestions: number
  totalQuestions: number
}

interface V2StatsResponse {
  success: boolean
  totalQuestions?: number
  globalAccuracy?: number
  currentStreak?: number
  questionsThisWeek?: number
  error?: string
}

interface AvatarDisplay {
  type: 'custom' | 'photo' | 'initial'
  element: ReactNode
  elementLarge: ReactNode
  fallback?: boolean
}

const EMPTY_STATS: UserStats = {
  streak: 0,
  accuracy: 0,
  weeklyQuestions: 0,
  totalQuestions: 0,
  userRegisteredDate: new Date(),
}

// ── Component ────────────────────────────────────────────────────

export default function UserAvatar() {
  const { user, loading: authLoading, signOut, supabase, isPremium } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const adminNotifications = useAdminNotifications(isAdmin && !adminLoading)
  const { issuesCount: sentryIssuesCount } = useSentryIssues(isAdmin && !adminLoading)
  const [userStats, setUserStats] = useState<UserStats>(EMPTY_STATS)
  const [statsLoading, setStatsLoading] = useState(false)
  const [pendingExams, setPendingExams] = useState<PendingExam[]>([])
  const [pendingExamsExpanded, setPendingExamsExpanded] = useState(false)

  // ── Pending exams: load on dropdown open, with AbortController ──

  useEffect(() => {
    if (!showDropdown) {
      setPendingExamsExpanded(false)
      return
    }
    if (!user?.id) return

    const controller = new AbortController()
    loadPendingExams(controller.signal)
    return () => controller.abort()
  }, [showDropdown, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPendingExams(signal?: AbortSignal) {
    try {
      const response = await fetch(
        `/api/exam/pending?userId=${user!.id}&testType=exam&limit=10`,
        { signal },
      )
      if (signal?.aborted) return
      const data = await response.json()
      if (data.success) {
        setPendingExams(data.exams || [])
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Error cargando examenes pendientes:', err)
      setPendingExams([])
    }
  }

  const pendingExamsCount = pendingExams.length

  // ── Stats: load with unmount protection (v2 API) ──

  useEffect(() => {
    if (!user || authLoading) {
      if (!authLoading && !user) setUserStats(EMPTY_STATS)
      return
    }

    let cancelled = false

    async function load() {
      if (statsLoading) return
      if (!user || !user.created_at) return

      const userCreatedAt = new Date(user.created_at)

      try {
        setStatsLoading(true)

        const res = await fetch(`/api/v2/user-stats?userId=${user.id}`)
        if (cancelled) return

        const data: V2StatsResponse = await res.json()

        if (!data.success) {
          console.error('UserAvatar: v2 stats error:', data.error)
          return
        }

        setUserStats({
          streak: data.currentStreak ?? 0,
          accuracy: data.globalAccuracy ?? 0,
          weeklyQuestions: data.questionsThisWeek ?? 0,
          totalQuestions: data.totalQuestions ?? 0,
          userRegisteredDate: userCreatedAt,
        })
      } catch (error) {
        if (cancelled) return
        console.warn('Error loading stats:', error)
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh stats on exam-completed event ──

  useEffect(() => {
    const handleExamCompleted = () => {
      if (!user?.id || !user.created_at) return
      console.log('UserAvatar: Refrescando stats despues de examen completado')
      loadPendingExams()

      const userCreatedAt = new Date(user.created_at)
      fetch(`/api/v2/user-stats?userId=${user.id}`)
        .then(res => res.json())
        .then((data: V2StatsResponse) => {
          if (!data.success) return
          setUserStats({
            streak: data.currentStreak ?? 0,
            accuracy: data.globalAccuracy ?? 0,
            weeklyQuestions: data.questionsThisWeek ?? 0,
            totalQuestions: data.totalQuestions ?? 0,
            userRegisteredDate: userCreatedAt,
          })
        })
        .catch(() => {})
    }

    window.addEventListener('exam-completed', handleExamCompleted)
    return () => window.removeEventListener('exam-completed', handleExamCompleted)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Admin check ──

  useEffect(() => {
    if (authLoading) return

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
        console.error('Error en verificacion de admin:', err)
        setIsAdmin(false)
      } finally {
        setAdminLoading(false)
      }
    }

    checkAdminStatus()
  }, [user, supabase, authLoading])

  // ── Handlers ──

  const handleSignOut = () => {
    setShowDropdown(false)
    signOut()
  }

  const handleLinkClick = () => {
    setShowDropdown(false)
  }

  // ── Memoised avatar display ──

  const avatarDisplay = useMemo<AvatarDisplay>(() => {
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
        ),
      }
    }

    // 2. Google/provider photo
    if (user?.user_metadata?.avatar_url || user?.user_metadata?.picture) {
      const avatarUrl = user!.user_metadata!.avatar_url || user!.user_metadata!.picture
      return {
        type: 'photo',
        element: (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-10 h-10 rounded-full border-2 border-green-500 object-cover"
            onError={(e) => {
              const target = e.currentTarget
              target.style.display = 'none'
              if (target.nextElementSibling instanceof HTMLElement) {
                target.nextElementSibling.style.display = 'flex'
              }
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
        fallback: true,
      }
    }

    // 3. Name/email initial
    const initial =
      user?.user_metadata?.full_name?.charAt(0).toUpperCase() ||
      user?.email?.charAt(0).toUpperCase() ||
      'U'

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
      ),
    }
  }, [user?.user_metadata?.avatar_type, user?.user_metadata?.avatar_emoji, user?.user_metadata?.avatar_color, user?.user_metadata?.avatar_url, user?.user_metadata?.picture, user?.user_metadata?.full_name, user?.email])

  // ── Memoised display name ──

  const displayName = useMemo(() => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name
    return user?.email || 'Usuario'
  }, [user?.user_metadata?.full_name, user?.email])

  // ── Render: loading ──

  if (authLoading) {
    return (
      <div className="animate-pulse">
        <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
      </div>
    )
  }

  // ── Render: no user ──

  if (!user) {
    return (
      <Link
        href="/login"
        className="bg-gradient-to-r from-green-700 to-green-800 text-white px-4 py-2 rounded-lg hover:from-green-800 hover:to-green-900 transition-all duration-200 font-medium text-sm"
      >
        Iniciar Sesion
      </Link>
    )
  }

  // ── Render: authenticated ──

  return (
    <div className="relative">
      {/* Clickable Avatar */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
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

          {/* Premium crown */}
          {isPremium && (
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-lg drop-shadow-md" title="Premium">
              👑
            </div>
          )}

          {/* Online indicator */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
        </div>

        {/* Name (only on large screens) */}
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-gray-900">
            {displayName}
          </div>
          {isPremium ? (
            <div className="text-xs text-amber-600 font-semibold">⭐ Premium</div>
          ) : (
            <div className="text-xs text-green-600">✅ Registrado</div>
          )}
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

          {/* Dropdown content */}
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
                    {displayName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {user.email}
                  </div>
                  {isPremium && (
                    <div className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mt-1">
                      ⭐ Premium
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-4 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-3">📊 Tu Progreso</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <div className="text-orange-600 text-xs mb-1">🔥 Racha</div>
                  <div className="font-bold text-orange-700 text-xl" data-testid="stat-streak">
                    {userStats.streak > 30 ? '30+' : userStats.streak}
                  </div>
                  <div className="text-orange-600 text-xs">dias consecutivos</div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-green-600 text-xs mb-1">🎯 Precision</div>
                  <div className="font-bold text-green-700 text-xl" data-testid="stat-accuracy">
                    {userStats.accuracy}%
                  </div>
                  <div className="text-green-600 text-xs">de aciertos</div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="text-blue-600 text-xs mb-1">📝 Esta semana</div>
                  <div className="font-bold text-blue-700 text-xl" data-testid="stat-weekly">
                    {userStats.weeklyQuestions}
                  </div>
                  <div className="text-blue-600 text-xs">preguntas hechas</div>
                </div>

                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <div className="text-purple-600 text-xs mb-1">📚 Total preguntas hechas</div>
                  <div className="font-bold text-purple-700 text-xl" data-testid="stat-total">
                    {userStats.totalQuestions}
                  </div>
                  <div className="text-purple-600 text-xs">
                    desde {userStats.userRegisteredDate.toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
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
                <span>Mis Estadisticas</span>
              </Link>

              {/* Pending exams */}
              {pendingExamsCount > 0 && (
                <div>
                  <button
                    onClick={() => setPendingExamsExpanded(!pendingExamsExpanded)}
                    className="w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 rounded-lg flex items-center space-x-3"
                  >
                    <span>📝</span>
                    <span>Examenes pendientes</span>
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

                  {pendingExamsExpanded && (
                    <div className="ml-6 mt-1 space-y-1 border-l-2 border-amber-200 pl-3">
                      {pendingExams.map((exam) => {
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

              {/* Admin link */}
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
                    <span className="ml-auto flex items-center gap-1">
                      {(adminNotifications?.feedback + adminNotifications?.impugnaciones) > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold" title="Feedback pendiente">
                          {(adminNotifications?.feedback + adminNotifications?.impugnaciones) > 9 ? '9+' : (adminNotifications?.feedback + adminNotifications?.impugnaciones)}
                        </span>
                      )}
                      {sentryIssuesCount > 0 && (
                        <span className="bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold" title="Errores en Sentry">
                          {sentryIssuesCount > 9 ? '9+' : sentryIssuesCount}
                        </span>
                      )}
                    </span>
                  </Link>
                </>
              )}

              <hr className="my-2" />

              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center space-x-3"
              >
                <span>🚪</span>
                <span>Cerrar Sesion</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
