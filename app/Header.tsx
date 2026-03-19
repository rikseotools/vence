// app/Header.tsx - Typed version
'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { MouseEvent } from 'react'
import { usePathname } from 'next/navigation'
import UserAvatar from '@/components/UserAvatar'
import NotificationBell from '@/components/NotificationBell'
import RankingModal from '@/components/RankingModal'
import FeedbackButton from '@/components/FeedbackButton'
import QuestionDispute from '@/components/QuestionDispute'
import { useNewMedalsBadge } from '@/hooks/useNewMedalsBadge'

import { LogoHorizontal, LogoIcon } from '@/components/Logo'
import { useOposicion } from '../contexts/OposicionContext'
import { useAuth } from '../contexts/AuthContext'
import { useUserOposicion } from '../components/useUserOposicion'
import { getOposicion } from '@/lib/config/oposiciones'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import DailyGoalBanner from '@/components/DailyGoalBanner'
import { useInteractionTracker } from '@/hooks/useInteractionTracker'
import { useSentryIssues } from '@/hooks/useSentryIssues'

// ── Types ────────────────────────────────────────────────────────

interface NavLink {
  href: string
  label: string
  icon: string
  featured?: boolean
}

interface MobileNavLink extends NavLink {
  isAdmin?: boolean
  badge?: number | null
  sentryBadge?: number | null
}

interface PendingExam {
  id: string
  title?: string | null
  temaNumber?: number | null
  answeredQuestions: number
  totalQuestions: number
}

// ── Component ────────────────────────────────────────────────────

export default function HeaderES() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [showRankingModal, setShowRankingModal] = useState(false)
  const [showQuestionDispute, setShowQuestionDispute] = useState(false)
  const [userStreak, setUserStreak] = useState(0)
  const [pendingFeedbacks, setPendingFeedbacks] = useState(0)
  const [pendingExams, setPendingExams] = useState<PendingExam[]>([])
  const [pendingPsychometric, setPendingPsychometric] = useState<{ id: string; categoryName: string | null; totalQuestions: number; questionsAnswered: number }[]>([])
  const [showPendingExamsDropdown, setShowPendingExamsDropdown] = useState(false)
  const [discardingExamId, setDiscardingExamId] = useState<string | null>(null)
  const [confirmingDiscardId, setConfirmingDiscardId] = useState<string | null>(null)
  const { hasNewMedals, newMedalsCount, markMedalsAsViewed } = useNewMedalsBadge()
  const pathname = usePathname()

  const { user, loading: authLoading, supabase, isPremium, isLegacy, userProfile } = useAuth()
  const oposicionContext = useOposicion()
  const { userOposicion: hookUserOposicion } = useUserOposicion() // Hook que SÍ funciona
  const adminNotifications = useAdminNotifications(isAdmin && !adminLoading)
  const { issuesCount: sentryIssuesCount } = useSentryIssues(isAdmin && !adminLoading)

  // 📊 Tracking de interacciones de usuario
  const { trackClick, trackNavigation } = useInteractionTracker()
  
  // Valores por defecto seguros
  const oposicionMenu = oposicionContext?.oposicionMenu || {
    color: 'blue',
    navLinks: []
  }
  const loading = oposicionContext?.loading || false
  const hasOposicion = oposicionContext?.hasOposicion || false
  const userOposicion = oposicionContext?.userOposicion || null
  const showNotification = oposicionContext?.showNotification || false
  const notificationData = (oposicionContext?.notificationData || null) as {
    type?: string; name?: string; message?: string
  } | null
  const dismissNotification = oposicionContext?.dismissNotification || (() => {})
  const needsOposicionFix = oposicionContext?.needsOposicionFix || false

  // 🆕 CARGAR RACHA DEL USUARIO
  useEffect(() => {
    async function loadUserStreak() {
      if (!user || !supabase) {
        setUserStreak(0)
        return
      }

      try {
        // ⚡ CONSULTA SÚPER OPTIMIZADA - Una sola query simple
        // Usar maybeSingle() para evitar error 406 cuando no existe el registro
        const { data: streakData, error: streakError } = await supabase
          .from('user_streaks')
          .select('current_streak')
          .eq('user_id', user.id)
          .maybeSingle()

        if (streakError) {
          console.warn('Error loading user streak:', streakError)
          setUserStreak(0)
          return
        }

        // Si no hay datos (usuario nuevo), la racha es 0
        setUserStreak(streakData?.current_streak || 0)
      } catch (error) {
        console.warn('Error calculating user streak:', error)
        setUserStreak(0)
      }
    }

    loadUserStreak()

    // 🔥 Escuchar evento para refrescar racha cuando se guarda una respuesta
    const handleRefreshStreak = () => {
      console.log('🔥 Refrescando racha del usuario...')
      loadUserStreak()
    }
    window.addEventListener('refreshUserStreak', handleRefreshStreak)
    return () => window.removeEventListener('refreshUserStreak', handleRefreshStreak)
  }, [user, supabase])


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

  // 🆕 CARGAR EXÁMENES Y TESTS PENDIENTES
  useEffect(() => {
    async function loadPendingExams() {
      if (!user) {
        setPendingExams([])
        setPendingPsychometric([])
        return
      }

      try {
        const examRes = await fetch(`/api/exam/pending?userId=${user.id}&testType=exam&limit=10`)
        const examData = await examRes.json()
        if (examData.success) {
          setPendingExams(examData.exams || [])
        }
        // Psicotécnicos no se muestran como pendientes (son pregunta a pregunta, no modo examen)
        setPendingPsychometric([])
      } catch (err) {
        console.error('Error cargando exámenes pendientes:', err)
        setPendingExams([])
        setPendingPsychometric([])
      }
    }

    if (!authLoading && user) {
      loadPendingExams()
    }

    // 🔄 Escuchar evento para refrescar cuando se completa un examen
    const handleExamCompleted = () => {
      console.log('🔄 Refrescando exámenes pendientes...')
      loadPendingExams()
    }
    window.addEventListener('examCompleted', handleExamCompleted)
    window.addEventListener('exam-completed', handleExamCompleted)
    return () => {
      window.removeEventListener('examCompleted', handleExamCompleted)
      window.removeEventListener('exam-completed', handleExamCompleted)
    }
  }, [user, authLoading])

  // Mostrar confirmacion inline para descartar
  function handleDiscardExam(examId: string, e?: MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    setConfirmingDiscardId(examId)
  }

  // Descartar examen permanentemente (despues de confirmar)
  async function confirmDiscardExam(examId: string) {
    if (!user?.id || !examId) return

    try {
      setDiscardingExamId(examId)
      setConfirmingDiscardId(null)
      const response = await fetch('/api/exam/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: examId, userId: user.id })
      })
      const result = await response.json()

      if (result.success) {
        setPendingExams(prev => prev.filter(ex => ex.id !== examId))
      } else {
        console.error('Error descartando examen:', result.error)
      }
    } catch (err) {
      console.error('Error descartando examen:', err)
    } finally {
      setDiscardingExamId(null)
    }
  }

  // Descartar sesión psicotécnica pendiente
  async function confirmDiscardPsychometric(sessionId: string) {
    if (!user?.id || !sessionId) return

    try {
      setDiscardingExamId(sessionId)
      setConfirmingDiscardId(null)
      const response = await fetch('/api/psychometric/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userId: user.id })
      })
      const result = await response.json()

      if (result.success) {
        setPendingPsychometric(prev => prev.filter(s => s.id !== sessionId))
      } else {
        console.error('Error descartando sesión psicotécnica:', result.error)
      }
    } catch (err) {
      console.error('Error descartando sesión psicotécnica:', err)
    } finally {
      setDiscardingExamId(null)
    }
  }

  // 🆕 VERIFICAR CONVERSACIONES DE FEEDBACK PENDIENTES (Sistema BD)
  useEffect(() => {
    async function checkPendingFeedbacks() {
      if (!user || !supabase || !isAdmin) {
        setPendingFeedbacks(0)
        return
      }

      try {
        // Consultar conversaciones abiertas no vistas por admin
        const { data, error } = await supabase
          .from('feedback_conversations')
          .select('id')
          .eq('status', 'open')
          .is('admin_viewed_at', null)

        if (error) {
          console.error('Error verificando feedbacks pendientes:', error)
          setPendingFeedbacks(0)
        } else {
          const unviewedCount = data?.length || 0
          if (unviewedCount > 0) {
            console.log(`🔔 Header: ${unviewedCount} conversaciones pendientes`)
          }
          setPendingFeedbacks(unviewedCount)
        }
      } catch (err) {
        console.error('Error en verificación de feedbacks:', err)
        setPendingFeedbacks(0)
      }
    }

    if (!authLoading && isAdmin) {
      checkPendingFeedbacks()

      // Verificar cada 30 segundos
      const interval = setInterval(checkPendingFeedbacks, 30000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [user, supabase, authLoading, isAdmin])

  // Enlaces simplificados para usuarios logueados
  const getLoggedInNavLinks = (): NavLink[] => {
    if (!hasOposicion || loading) {
      return [
        { href: '/auxiliar-administrativo-estado/test', label: 'Test', icon: '🎯' },
        { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
        { href: '/leyes', label: 'Leyes', icon: '⚖️' },
        { href: '/test/por-leyes', label: 'Por Leyes', icon: '📖' },
        { href: '/psicotecnicos/test', label: 'Psicotécnicos', icon: '🧩' },
        { href: '/oposiciones', label: 'Oposiciones', icon: '📋' }
      ]
    }

    try {
      const featuredLink = oposicionMenu?.navLinks?.find(link => link?.featured)
      const basePath = featuredLink?.href || '/auxiliar-administrativo-estado'

      return [
        { href: `${basePath}/test`, label: 'Test', icon: '🎯' },
        { href: `${basePath}/temario`, label: 'Temario', icon: '📚' },
        { href: '/leyes', label: 'Leyes', icon: '⚖️' },
        { href: '/test/por-leyes', label: 'Por Leyes', icon: '📖' },
        { href: '/psicotecnicos/test', label: 'Psicotécnicos', icon: '🧩' },
        { href: '/oposiciones', label: 'Oposiciones', icon: '📋' }
      ]
    } catch (error) {
      console.warn('Error generando enlaces:', error)
      return [
        { href: '/auxiliar-administrativo-estado/test', label: 'Test', icon: '🎯' },
        { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
        { href: '/leyes', label: 'Leyes', icon: '⚖️' },
        { href: '/test/por-leyes', label: 'Por Leyes', icon: '📖' },
        { href: '/psicotecnicos/test', label: 'Psicotécnicos', icon: '🧩' },
        { href: '/oposiciones', label: 'Oposiciones', icon: '📋' }
      ]
    }
  }

  // Enlaces para usuarios NO logueados
  const getGuestNavLinks = (): NavLink[] => {
    return [
      { href: '/auxiliar-administrativo-estado/test', label: 'Test', icon: '🎯' },
      { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/leyes', label: 'Leyes', icon: '⚖️' },
      { href: '/test/por-leyes', label: 'Por Leyes', icon: '📖' },
      { href: '/psicotecnicos', label: 'Psicotécnicos', icon: '🧩' },
      { href: '/oposiciones', label: 'Oposiciones', icon: '📋' }
    ]
  }

  // 🆕 ENLACES PARA MÓVIL (incluye Admin si es admin)
  const getMobileNavLinks = (): MobileNavLink[] => {
    const baseLinks: MobileNavLink[] = user ? getLoggedInNavLinks() : getGuestNavLinks()

    // Agregar enlace de Admin si es admin
    if (user && isAdmin && !adminLoading) {
      return [
        ...baseLinks,
        {
          href: '/admin',
          label: 'Panel Admin',
          icon: '👨‍💼',
          isAdmin: true,
          badge: pendingFeedbacks > 0 ? pendingFeedbacks : null,
          sentryBadge: sentryIssuesCount > 0 ? sentryIssuesCount : null
        }
      ]
    }

    return baseLinks
  }

  // Cerrar menú cuando cambie la ruta
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const handleLinkClick = (linkName?: string) => {
    if (linkName) {
      trackClick('Header', 'nav_click', { linkName })
    }
    setIsMobileMenuOpen(false)
  }

  const toggleMobileMenu = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 📊 Tracking de toggle menú móvil
    trackClick('Header', 'mobile_menu_toggle', { willOpen: !isMobileMenuOpen })
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Funcion para obtener el enlace a tests de la oposicion objetivo
  const getTestsLink = (): string => {
    // hookUserOposicion puede ser un string JSON o un objeto
    let oposicionData: Record<string, unknown> | null = hookUserOposicion as Record<string, unknown> | null
    if (typeof hookUserOposicion === 'string') {
      try {
        oposicionData = JSON.parse(hookUserOposicion)
      } catch {
        oposicionData = null
      }
    }
    const oposicionId = (oposicionData?.id || oposicionData?.slug) as string | undefined
    if (!oposicionId) return '/'

    const oposicion = getOposicion(oposicionId)
    return oposicion ? `/${oposicion.slug}/test` : '/'
  }

  // Obtener color dinamico
  const getColorClasses = (isActive: boolean): string => {
    const baseColor = oposicionMenu?.color || 'blue'
    
    if (isActive) {
      switch(baseColor) {
        case 'emerald':
          return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
        case 'blue':
          return 'bg-blue-100 text-blue-800 border border-blue-200'
        case 'purple':
          return 'bg-purple-100 text-purple-800 border border-purple-200'
        default:
          return 'bg-blue-100 text-blue-800 border border-blue-200'
      }
    }
    
    return 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-sm'
  }

  // Mostrar loading mientras se verifica auth
  if (authLoading) {
    return (
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700 sticky top-0 z-50 h-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            {/* Logo con loading - Responsive y más grande */}
            <div className="flex items-center">
              {/* Logo solo icono en móvil - extra grande con más espacio */}
              <div className="xl:hidden py-3">
                  <LogoIcon size={48} />
              </div>
              {/* Logo horizontal solo en desktop */}
              <div className="hidden xl:block">
                <LogoHorizontal className="scale-125" />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="animate-pulse">
                <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <>
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700 sticky top-0 z-50 relative min-h-16">
        <div className={`container mx-auto px-2 sm:px-4 ${user ? 'py-6 pb-12 xl:pb-6' : 'py-6'}`}>
          <div className="flex items-center justify-between relative overflow-visible">
            
            {/* 🔥 SEGUNDA LÍNEA MÓVIL - RACHA + LEYES + SOPORTE */}
            {user && (
              <div className="xl:hidden absolute top-full left-0 right-0 flex items-center gap-3 mt-1 mb-2 pl-2 pr-2 sm:pl-4 sm:pr-4 overflow-visible flex-wrap">
                {/* 🔥 ICONO DE RACHA */}
                <button
                  onClick={() => {
                    setShowRankingModal(true)
                    // Establecer tab rachas cuando se abra el modal desde la racha
                    setTimeout(() => {
                      // Buscar el botón de rachas y hacer click
                      const rachaBtnElement = document.querySelector<HTMLElement>('[data-tab="rachas"]')
                      rachaBtnElement?.click()
                    }, 100)
                  }}
                  className={`flex items-center justify-center hover:opacity-80 transition-opacity ${userStreak === 0 ? 'opacity-60' : ''}`}
                  title={userStreak === 0 ? 'Comienza tu racha estudiando hoy' : `Tu racha: ${userStreak} días consecutivos`}
                >
                  <span className={`text-sm ${userStreak === 0 ? 'grayscale' : ''}`}>🔥</span>
                  <span className="text-sm font-bold ml-0.5">{userStreak}</span>
                </button>
                
                {/* ⚖️ ICONO DE LEYES */}
                <Link
                  href="/leyes"
                  className="flex items-center justify-center p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                  aria-label="Ir a Leyes"
                  title="Estudiar Leyes"
                >
                  <span className="text-lg">⚖️</span>
                </Link>

                {/* 💬 ICONO DE SOPORTE */}
                <Link
                  href="/soporte"
                  className="flex items-center justify-center p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                  aria-label="Contactar soporte"
                  title="Contactar soporte"
                >
                  <span className="text-lg">💬</span>
                </Link>

                {/* 👑 BOTÓN PREMIUM - Solo usuarios FREE */}
                {!isPremium && !isLegacy && userProfile?.plan_type !== 'trial' && (
                  <Link
                    href="/premium"
                    onClick={() => trackClick('Header', 'premium_button_click', { location: 'mobile' })}
                    className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                  >
                    <span>👑</span>
                    <span>Hazte Premium</span>
                  </Link>
                )}

                {/* Botón de Vence AI - Móvil */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('openAIChat', { detail: {} }))}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-900 text-white rounded-lg text-xs font-semibold shadow-sm"
                  title="Abrir Vence AI"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5L9.5 2z"/>
                    <path d="M18 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L14.5 11l2.5-1L18 8z"/>
                    <path d="M9.5 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L6 18l2.5-1 1-2.5z"/>
                  </svg>
                  <span>IA</span>
                </button>

                {/* 📖 Por Leyes - Móvil */}
                <Link
                  href="/test/por-leyes"
                  className="flex items-center"
                  title="Test Por Leyes"
                >
                  <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                  </svg>
                </Link>

                {/* 📊 Meta diaria - Móvil (después de diana) */}
                <DailyGoalBanner />

                {/* 📝 Exámenes pendientes - Móvil (oculto cuando se ve el desktop) */}
                {(pendingExams.length + pendingPsychometric.length) > 0 && (
                  <div className="relative lg:hidden">
                    <button
                      onClick={() => setShowPendingExamsDropdown(!showPendingExamsDropdown)}
                      className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                      title="Tests pendientes"
                    >
                      <span>📝</span>
                      <span>{pendingExams.length + pendingPsychometric.length}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* IZQUIERDA: Logo más pequeño en móvil */}
            <div className="flex items-center flex-shrink-0">
              {/* Logo responsive - más pequeño en móvil */}
              <div className="flex items-center">
                {/* Logo solo icono en móvil - tamaño reducido */}
                <div className="xl:hidden py-1">
                    <LogoIcon size={48} />
                </div>
                {/* Logo horizontal solo en desktop - 25% mas grande */}
                <div className="hidden xl:block">
                  <LogoHorizontal className="scale-125" />
                </div>
              </div>
            </div>
            
            {/* NAVEGACIÓN COMPLETA DESKTOP */}
            <nav className="hidden xl:flex items-center justify-center flex-1 mx-8">
              <div className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-800 rounded-full p-1">
                {(user ? getLoggedInNavLinks() : getGuestNavLinks()).map((link) => (
                  <Link 
                    key={link.href}
                    href={link.href} 
                    className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all duration-200 ${
                      getColorClasses(pathname === link.href)
                    }`}
                  >
                    <span className="text-sm">{link.icon}</span>
                    <span className="text-sm font-medium">{link.label}</span>
                  </Link>
                ))}
              </div>
            </nav>

            {/* DERECHA: Notificaciones + Menú hamburguesa + Avatar del usuario */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {/* 🎧 BOTÓN DE SOPORTE - Solo en desktop */}
              <Link
                href="/soporte"
                className="hidden xl:flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors text-blue-700 hover:text-blue-800"
                title="Contactar soporte"
              >
                <span className="text-sm">💬</span>
                <span className="text-sm font-medium">Soporte</span>
              </Link>

              {/* 👑 BOTÓN PREMIUM - Solo usuarios FREE en desktop */}
              {user && !isPremium && !isLegacy && userProfile?.plan_type !== 'trial' && (
                <Link
                  href="/premium"
                  onClick={() => trackClick('Header', 'premium_button_click', { location: 'desktop' })}
                  className="hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  <span>👑</span>
                  <span className="text-sm">Hazte Premium</span>
                </Link>
              )}

              {/* Botón de Vence AI - Desktop */}
              {user && (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('openAIChat', { detail: {} }))}
                  className="hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-900 hover:bg-blue-950 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                  title="Abrir Vence AI"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5L9.5 2z"/>
                    <path d="M18 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L14.5 11l2.5-1L18 8z"/>
                    <path d="M9.5 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L6 18l2.5-1 1-2.5z"/>
                  </svg>
                  <span className="text-sm">IA</span>
                </button>
              )}

              {/* 📝 Tests pendientes - Desktop */}
              {user && (pendingExams.length + pendingPsychometric.length) > 0 && (
                <div className="relative hidden lg:block">
                  <button
                    onClick={() => setShowPendingExamsDropdown(!showPendingExamsDropdown)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                    title="Tests pendientes"
                  >
                    <span>📝</span>
                    <span className="text-sm">{pendingExams.length + pendingPsychometric.length}</span>
                  </button>
                </div>
              )}

              {/* Icono de ranking/liga y racha (solo usuarios logueados) */}
              {user && (
                <div className="relative">
                  {/* Botón de medallas alineado con otros iconos */}
                  {hasNewMedals ? (
                    // Botón con trofeo parpadeante cuando hay medallas nuevas
                    <button
                      onClick={async () => {
                        setShowRankingModal(true)
                        await markMedalsAsViewed()
                        // Establecer tab ranking cuando se abra desde medallas
                        setTimeout(() => {
                          const rankingBtnElement = document.querySelector<HTMLElement>('[data-tab="ranking"]')
                          rankingBtnElement?.click()
                        }, 100)
                      }}
                      className="relative p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                      aria-label="Ver ranking de usuarios"
                      title={`Ranking y Liga - ${newMedalsCount} medalla(s) nueva(s)`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 01 3.138-3.138z" />
                      </svg>
                      
                      {/* Trofeo parpadeante como antes */}
                      <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        🏆
                      </span>
                    </button>
                  ) : (
                    // Botón normal sin trofeo cuando no hay medallas nuevas
                    <button
                      onClick={() => {
                        setShowRankingModal(true)
                        // Establecer tab ranking cuando se abra desde medallas
                        setTimeout(() => {
                          const rankingBtnElement = document.querySelector<HTMLElement>('[data-tab="ranking"]')
                          rankingBtnElement?.click()
                        }, 100)
                      }}
                      className="relative p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                      aria-label="Ver ranking de usuarios"
                      title="Ranking y Liga"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {/* 🔥 ICONO DE RACHA DESKTOP - Al lado de medallas */}
              {user && (
                <button
                  onClick={() => {
                    setShowRankingModal(true)
                    // Establecer tab rachas cuando se abra el modal desde la racha
                    setTimeout(() => {
                      const rachaBtnElement = document.querySelector<HTMLElement>('[data-tab="rachas"]')
                      rachaBtnElement?.click()
                    }, 100)
                  }}
                  className={`hidden xl:flex items-center p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors ${userStreak === 0 ? 'opacity-60' : ''}`}
                  aria-label="Ver ranking de rachas"
                  title={userStreak === 0 ? 'Comienza tu racha estudiando hoy' : `Tu racha: ${userStreak} días consecutivos`}
                >
                  <span className={`text-lg ${userStreak === 0 ? 'grayscale' : ''}`}>🔥</span>
                  <span className="text-sm font-bold ml-1">{userStreak}</span>
                </button>
              )}

              {/* 🎯 ICONO DE TESTS - Solo en móvil */}
              {user && (
                <Link
                  href={getTestsLink()}
                  className="xl:hidden p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                  aria-label="Ir a Tests"
                  title="Tests de Práctica"
                >
                  <span className="text-xl">🎯</span>
                </Link>
              )}

              {/* 📚 ICONO DE TEMARIO - Solo en móvil */}
              {user && (
                <Link
                  href={(() => {
                    const testsLink = getTestsLink()
                    return testsLink === '/' ? '/auxiliar-administrativo-estado/temario' : testsLink.replace('/test', '/temario')
                  })()}
                  className="xl:hidden p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                  aria-label="Ir a Temario"
                  title="Ver Temario"
                >
                  <span className="text-xl">📚</span>
                </Link>
              )}

              {/* 🧩 ICONO DE PSICOTÉCNICOS - Solo en móvil */}
              {user && (
                <Link
                  href="/psicotecnicos/test"
                  className="xl:hidden p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                  aria-label="Ir a Psicotécnicos"
                  title="Tests Psicotécnicos"
                >
                  <span className="text-xl">🧩</span>
                </Link>
              )}

              {/* 📊 Meta diaria - Solo en desktop (en móvil va en segunda línea) */}
              <div className="hidden xl:block">
                {user && <DailyGoalBanner />}
              </div>

              {/* Campana de notificaciones (solo usuarios logueados) */}
              {user && <NotificationBell />}

              {/* Botón menú hamburguesa con texto "Menú" */}
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="xl:hidden flex items-center space-x-1 px-2 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={isMobileMenuOpen}
              >
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Menú</span>
                <div className="relative w-3 h-3 text-gray-700 dark:text-gray-300">
                  {isMobileMenuOpen ? (
                    <svg className="w-3 h-3 transition-transform duration-200 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Avatar del usuario */}
              <UserAvatar />
            </div>
          </div>


          {/* MENÚ MÓVIL */}
          <div className={`xl:hidden absolute left-0 right-0 top-full bg-white dark:bg-gray-900 shadow-lg border-t border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ease-in-out ${
            isMobileMenuOpen 
              ? 'opacity-100 visible' 
              : 'opacity-0 invisible'
          }`}>
            <nav className="bg-white dark:bg-gray-900 p-4">
              
              {/* Indicador de oposición móvil (solo si usuario logueado) */}
              {user && hasOposicion && !loading && oposicionMenu?.name && (
                <div className="mb-4 p-3 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/50 dark:to-cyan-900/50 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{oposicionMenu?.icon || '📚'}</span>
                    <div>
                      <div className="font-bold text-emerald-800 dark:text-emerald-200">Estudiando: {oposicionMenu?.name}</div>
                      <div className="text-sm text-emerald-600 dark:text-emerald-400">
                        {oposicionMenu?.badge && `Categoría ${oposicionMenu?.badge} • `}Acceso rápido
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enlaces de navegación móvil */}
              <div className="grid grid-cols-1 gap-2">
                {getMobileNavLinks().map((link) => (
                  <Link 
                    key={link.href}
                    href={link.href} 
                    className={`flex items-center space-x-3 py-4 px-4 rounded-lg font-medium transition-colors touch-manipulation ${
                      link.isAdmin ? 
                        'bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' :
                      pathname === link.href
                        ? (oposicionMenu?.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                           oposicionMenu?.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' :
                           oposicionMenu?.color === 'purple' ? 'bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' :
                           'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800')
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 active:bg-gray-100 dark:active:bg-gray-700'
                    }`}
                    onClick={() => handleLinkClick(link.label)}
                  >
                    <span className="text-2xl">{link.icon}</span>
                    <div className="flex-1 relative">
                      <span className="text-lg font-medium">{link.label}</span>
                      {link.isAdmin && (
                        <div className="text-xs text-red-600 dark:text-red-400">Panel de Administración</div>
                      )}
                    </div>
                    {link.badge && (
                      <span className="bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-bounce">
                        {link.badge > 9 ? '9+' : link.badge}
                      </span>
                    )}
                    {link.sentryBadge && (
                      <span className="bg-orange-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold" title="Errores en Sentry">
                        {link.sentryBadge > 9 ? '9+' : link.sentryBadge}
                      </span>
                    )}
                    {(pathname === link.href || (link.isAdmin && pathname.startsWith('/admin'))) && (
                      <span className={
                        link.isAdmin ? 'text-red-500' :
                        oposicionMenu?.color === 'emerald' ? 'text-emerald-500' :
                        oposicionMenu?.color === 'blue' ? 'text-blue-500' :
                        oposicionMenu?.color === 'purple' ? 'text-purple-500' :
                        'text-blue-500'
                      }>✓</span>
                    )}
                  </Link>
                ))}
              </div>

            </nav>
          </div>
        </div>
        
        {/* Overlay para cerrar menú móvil */}
        {isMobileMenuOpen && (
          <div 
            className="xl:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-40" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </header>

      {/* Notificación de cambio de oposición */}
      {showNotification && (notificationData?.name || notificationData?.message) && (
        <div className={`${
          notificationData.type === 'oposicionChanged'
            ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
            : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
        } text-white px-4 py-3 text-center relative`}>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-xl">{notificationData.type === 'oposicionChanged' ? '🎯' : '🎉'}</span>
            <span className="font-medium">
              {notificationData.type === 'oposicionChanged'
                ? (notificationData.message || <>Tu oposición objetivo se ha cambiado a <strong>{notificationData.name}</strong></>)
                : <>¡Perfecto! Ahora estudias: <strong>{notificationData.name}</strong></>
              }
            </span>
            {notificationData.type !== 'oposicionChanged' && (
              <span className="text-sm opacity-90">• Acceso rápido activado</span>
            )}
          </div>
          <button
            onClick={dismissNotification}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner: oposición no disponible - forzar re-selección */}
      {needsOposicionFix && user && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="font-medium">
              La oposición que tienes seleccionada aún no está disponible en Vence. Elige una de las disponibles.
            </span>
            <a
              href="/perfil"
              className="inline-flex items-center gap-1 bg-white text-orange-600 font-semibold px-4 py-1.5 rounded-full text-sm hover:bg-orange-50 transition-colors"
            >
              Cambiar oposición
            </a>
          </div>
        </div>
      )}

      {/* Dropdown de tests pendientes */}
      {showPendingExamsDropdown && (pendingExams.length + pendingPsychometric.length) > 0 && (
        <>
          {/* Overlay para cerrar */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPendingExamsDropdown(false)}
          />
          {/* Dropdown */}
          <div className="fixed top-16 right-4 z-50 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-amber-200 dark:border-amber-700 overflow-hidden animate-in slide-in-from-top-2">
            <div className="bg-amber-100 dark:bg-amber-900 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <span className="font-semibold text-amber-800 dark:text-amber-200">
                  {(() => {
                    const total = pendingExams.length + pendingPsychometric.length
                    return total === 1 ? 'Test pendiente' : `${total} tests pendientes`
                  })()}
                </span>
              </div>
              <button
                onClick={() => setShowPendingExamsDropdown(false)}
                className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
              {pendingExams.map(exam => {
                const progress = exam.totalQuestions > 0
                  ? Math.round((exam.answeredQuestions / exam.totalQuestions) * 100)
                  : 0
                let resumeUrl
                if (exam.title?.toLowerCase().includes('examen oficial')) {
                  resumeUrl = `/auxiliar-administrativo-estado/test/examen-oficial?resume=${exam.id}`
                } else if (exam.title?.toLowerCase().includes('aleatorio') || exam.temaNumber === 0 || exam.temaNumber === null) {
                  resumeUrl = `/test/aleatorio-examen?resume=${exam.id}`
                } else {
                  resumeUrl = `/auxiliar-administrativo-estado/test/tema/${exam.temaNumber || 1}/test-examen?resume=${exam.id}`
                }

                const isConfirming = confirmingDiscardId === exam.id
                const isDiscarding = discardingExamId === exam.id

                return (
                  <div
                    key={exam.id}
                    className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700 overflow-hidden"
                  >
                    {isConfirming ? (
                      <div className="text-center py-1">
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          ¿Descartar este examen?
                        </p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setConfirmingDiscardId(null)}
                            className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => confirmDiscardExam(exam.id)}
                            className="px-3 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                          >
                            Sí, descartar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <Link
                          href={resumeUrl}
                          onClick={() => setShowPendingExamsDropdown(false)}
                          className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                        >
                          <div className="font-medium text-gray-800 dark:text-gray-200 truncate text-sm">
                            {exam.title || `Tema ${exam.temaNumber}`}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 bg-amber-200 dark:bg-amber-800 rounded-full h-1.5">
                              <div
                                className="bg-amber-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap">
                              {exam.answeredQuestions}/{exam.totalQuestions}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                            Click para continuar →
                          </div>
                        </Link>
                        <button
                          onClick={(e) => handleDiscardExam(exam.id, e)}
                          disabled={isDiscarding}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                          title="Descartar examen"
                        >
                          {isDiscarding ? (
                            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Psychometric pending sessions */}
              {pendingPsychometric.map(session => {
                const progress = session.totalQuestions > 0
                  ? Math.round((session.questionsAnswered / session.totalQuestions) * 100)
                  : 0

                const isDiscardingPsycho = discardingExamId === session.id

                return (
                  <div
                    key={session.id}
                    className="p-2.5 bg-violet-50 dark:bg-violet-900/30 rounded-lg border border-violet-200 dark:border-violet-700 overflow-hidden"
                  >
                    {confirmingDiscardId === session.id ? (
                      <div className="text-center py-1">
                        <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">¿Descartar este test?</p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setConfirmingDiscardId(null)}
                            className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => confirmDiscardPsychometric(session.id)}
                            className="px-3 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                          >
                            Sí, descartar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <Link
                          href={`/psicotecnicos/test/ejecutar?resume=${session.id}`}
                          onClick={() => setShowPendingExamsDropdown(false)}
                          className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                        >
                          <div className="font-medium text-gray-800 dark:text-gray-200 truncate text-sm">
                            🧠 {session.categoryName || 'Test psicotécnico'}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 bg-violet-200 dark:bg-violet-800 rounded-full h-1.5">
                              <div
                                className="bg-violet-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-violet-700 dark:text-violet-300 whitespace-nowrap">
                              {session.questionsAnswered}/{session.totalQuestions}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-violet-600 dark:text-violet-400">
                            Click para continuar →
                          </div>
                        </Link>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingDiscardId(session.id) }}
                          disabled={isDiscardingPsycho}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                          title="Descartar test"
                        >
                          {isDiscardingPsycho ? (
                            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Modal de ranking */}
      <RankingModal
        isOpen={showRankingModal}
        onClose={() => setShowRankingModal(false)}
      />

      {/* 💬 BOTÓN DE FEEDBACK FLOTANTE - Solo desktop */}
      <div className="hidden xl:block">
        <FeedbackButton />
      </div>

      {/* Modal de QuestionDispute */}
      <QuestionDispute
        questionId={null}
        user={user}
        isOpen={showQuestionDispute}
        onClose={() => setShowQuestionDispute(false)}
      />
      
    </>
  )
}