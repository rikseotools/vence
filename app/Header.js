// app/Header.js - VERSIÓN CON ENLACE DE ADMIN Y LOGO SEPARADO EN MÓVIL
'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import UserAvatar from '@/components/UserAvatar'
import NotificationBell from '@/components/NotificationBell'
import RankingModal from '@/components/RankingModal'
import FeedbackButton from '@/components/FeedbackButton'
import FeedbackModal from '@/components/FeedbackModal'
import QuestionDispute from '@/components/QuestionDispute'
import { useNewMedalsBadge } from '@/hooks/useNewMedalsBadge'
import '@/lib/debug/medalDebug' // Cargar funciones de debug
import { LogoHorizontal, LogoIcon } from '@/components/Logo'
import { useOposicion } from '../contexts/OposicionContext'
import { useAuth } from '../contexts/AuthContext'
import { useUserOposicion } from '../components/useUserOposicion'
// import { calculateUserStreak } from '@/utils/streakCalculator' // 🚫 YA NO NECESARIO
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { useInteractionTracker } from '@/hooks/useInteractionTracker'
import { useSentryIssues } from '@/hooks/useSentryIssues'

export default function HeaderES() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [showRankingModal, setShowRankingModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showQuestionDispute, setShowQuestionDispute] = useState(false)
  const [userStreak, setUserStreak] = useState(0)
  const [pendingFeedbacks, setPendingFeedbacks] = useState(0)
  const [pendingExams, setPendingExams] = useState([])
  const [showPendingExamsDropdown, setShowPendingExamsDropdown] = useState(false)
  const { hasNewMedals, newMedalsCount, markMedalsAsViewed } = useNewMedalsBadge()
  const pathname = usePathname()

  const { user, loading: authLoading, supabase, isPremium, isLegacy, userProfile } = useAuth()
  const oposicionContext = useOposicion()
  const { userOposicion: hookUserOposicion } = useUserOposicion() // Hook que SÍ funciona
  const adminNotifications = useAdminNotifications()
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
  const notificationData = oposicionContext?.notificationData || null
  const dismissNotification = oposicionContext?.dismissNotification || (() => {})

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


  // Función de cálculo de racha movida a utils/streakCalculator.js para evitar duplicación

  // 🆕 VERIFICAR SI ES ADMIN
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

  // 🆕 CARGAR EXÁMENES PENDIENTES
  useEffect(() => {
    async function loadPendingExams() {
      if (!user) {
        setPendingExams([])
        return
      }

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

    if (!authLoading && user) {
      loadPendingExams()
    }

    // 🔄 Escuchar evento para refrescar cuando se completa un examen
    const handleExamCompleted = () => {
      console.log('🔄 Refrescando exámenes pendientes...')
      loadPendingExams()
    }
    window.addEventListener('examCompleted', handleExamCompleted)
    return () => window.removeEventListener('examCompleted', handleExamCompleted)
  }, [user, authLoading])

  // 🆕 VERIFICAR CONVERSACIONES DE FEEDBACK PENDIENTES (Sistema BD)
  useEffect(() => {
    async function checkPendingFeedbacks() {
      if (!user || !supabase || !isAdmin) {
        setPendingFeedbacks(0)
        return
      }

      try {
        // Consultar directamente conversaciones no vistas en BD
        const { data, error } = await supabase
          .from('feedback_conversations')
          .select('id')
          .eq('status', 'waiting_admin')
          .is('admin_viewed_at', null) // Solo las que no han sido vistas por admin

        if (error) {
          // Si el campo admin_viewed_at no existe, usar fallback temporal
          if (error.message && error.message.includes('admin_viewed_at')) {
            console.log('⚠️ Campo admin_viewed_at no existe, usando conteo básico como fallback')
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('feedback_conversations')
              .select('id')
              .eq('status', 'waiting_admin')
            
            if (fallbackError) {
              console.error('Error en fallback de feedbacks pendientes:', fallbackError)
              setPendingFeedbacks(0)
            } else {
              const count = fallbackData?.length || 0
              console.log(`🔔 Header (fallback): ${count} conversaciones esperando admin`)
              setPendingFeedbacks(count)
            }
          } else {
            console.error('Error verificando feedbacks pendientes:', error)
            setPendingFeedbacks(0)
          }
        } else {
          const unviewedCount = data?.length || 0
          // Solo loguear si hay pendientes
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
  }, [user, supabase, authLoading, isAdmin])

  // Enlaces simplificados para usuarios logueados
  const getLoggedInNavLinks = () => {
    if (!hasOposicion || loading) {
      return [
        { href: '/auxiliar-administrativo-estado/test', label: 'Test', icon: '🎯' },
        { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
        { href: '/leyes', label: 'Leyes', icon: '⚖️' },
        { href: '/test-oposiciones', label: 'Test Oposiciones', icon: '📋' },
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
        { href: '/test-oposiciones', label: 'Test Oposiciones', icon: '📋' },
        { href: '/psicotecnicos/test', label: 'Psicotécnicos', icon: '🧩' },
        { href: '/oposiciones', label: 'Oposiciones', icon: '📋' }
      ]
    } catch (error) {
      console.warn('Error generando enlaces:', error)
      return [
        { href: '/auxiliar-administrativo-estado/test', label: 'Test', icon: '🎯' },
        { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
        { href: '/leyes', label: 'Leyes', icon: '⚖️' },
        { href: '/test-oposiciones', label: 'Test Oposiciones', icon: '📋' },
        { href: '/psicotecnicos/test', label: 'Psicotécnicos', icon: '🧩' },
        { href: '/oposiciones', label: 'Oposiciones', icon: '📋' }
      ]
    }
  }

  // Enlaces para usuarios NO logueados
  const getGuestNavLinks = () => {
    return [
      { href: '/auxiliar-administrativo-estado/test', label: 'Test', icon: '🎯' },
      { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/leyes', label: 'Leyes', icon: '⚖️' },
      { href: '/test-oposiciones', label: 'Test Oposiciones', icon: '📋' },
      { href: '/psicotecnicos', label: 'Psicotécnicos', icon: '🧩' },
      { href: '/oposiciones', label: 'Oposiciones', icon: '📋' }
    ]
  }

  // 🆕 ENLACES PARA MÓVIL (incluye Admin si es admin)
  const getMobileNavLinks = () => {
    const baseLinks = user ? getLoggedInNavLinks() : getGuestNavLinks()
    
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

  const handleLinkClick = (linkName) => {
    // 📊 Tracking de click en navegación
    if (linkName) {
      trackClick('Header', 'nav_click', { linkName })
    }
    setIsMobileMenuOpen(false)
  }

  const toggleMobileMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // 📊 Tracking de toggle menú móvil
    trackClick('Header', 'mobile_menu_toggle', { willOpen: !isMobileMenuOpen })
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Función para obtener el enlace a tests de la oposición objetivo
  const getTestsLink = () => {
    // hookUserOposicion puede ser un string JSON o un objeto
    let oposicionData = hookUserOposicion
    if (typeof hookUserOposicion === 'string') {
      try {
        oposicionData = JSON.parse(hookUserOposicion)
      } catch (e) {
        oposicionData = null
      }
    }
    const oposicionId = oposicionData?.id || oposicionData?.slug

    // Administrativo del Estado (C1)
    if (oposicionId === 'administrativo-estado' || oposicionId === 'administrativo_estado') {
      return '/administrativo-estado/test'
    }

    // Auxiliar Administrativo del Estado (C2)
    if (oposicionId === 'auxiliar-administrativo-estado' || oposicionId === 'auxiliar_administrativo_estado') {
      return '/auxiliar-administrativo-estado/test'
    }

    // Si es otra oposición o no hay oposición definida, ir a home
    return '/'
  }

  // Obtener color dinámico
  const getColorClasses = (isActive) => {
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
                  <LogoIcon size={48} onClick={handleLinkClick} />
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
        <div className={`container mx-auto px-4 ${user ? 'py-6 pb-12 xl:pb-6' : 'py-6'}`}>
          <div className="flex items-center justify-between relative">
            
            {/* 🔥 SEGUNDA LÍNEA MÓVIL - RACHA + LEYES + SOPORTE */}
            {user && (
              <div className="xl:hidden absolute top-full left-0 flex items-center gap-4 mt-1 mb-2 pl-4">
                {/* 🔥 ICONO DE RACHA */}
                <button
                  onClick={() => {
                    setShowRankingModal(true)
                    // Establecer tab rachas cuando se abra el modal desde la racha
                    setTimeout(() => {
                      // Buscar el botón de rachas y hacer click
                      const rachaBtnElement = document.querySelector('[data-tab="rachas"]')
                      if (rachaBtnElement) {
                        rachaBtnElement.click()
                      }
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
                <button
                  onClick={() => {
                    setShowFeedbackModal(true)
                    // Refrescar notificaciones admin inmediatamente al abrir feedback
                    if (isAdmin && adminNotifications?.refresh) {
                      adminNotifications.refresh()
                    }
                  }}
                  className="flex items-center justify-center p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                  aria-label="Contactar soporte"
                  title="Contactar soporte"
                >
                  <span className="text-lg">💬</span>
                </button>

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

                {/* 📝 Exámenes pendientes - Móvil */}
                {pendingExams.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowPendingExamsDropdown(!showPendingExamsDropdown)}
                      className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                      title="Exámenes pendientes"
                    >
                      <span>📝</span>
                      <span>{pendingExams.length}</span>
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
                    <LogoIcon size={48} onClick={handleLinkClick} />
                </div>
                {/* Logo horizontal solo en desktop - 25% más grande */}
                <div className="hidden xl:block">
                  <LogoHorizontal className="scale-125" onClick={handleLinkClick} />
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
              <button
                onClick={() => {
                  setShowFeedbackModal(true)
                  // Refrescar notificaciones admin inmediatamente al abrir feedback
                  if (isAdmin && adminNotifications?.refresh) {
                    adminNotifications.refresh()
                  }
                }}
                className="hidden xl:flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors text-blue-700 hover:text-blue-800"
                title="Contactar soporte"
              >
                <span className="text-sm">💬</span>
                <span className="text-sm font-medium">Soporte</span>
              </button>

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

              {/* 📝 Exámenes pendientes - Desktop */}
              {user && pendingExams.length > 0 && (
                <div className="relative hidden xl:block">
                  <button
                    onClick={() => setShowPendingExamsDropdown(!showPendingExamsDropdown)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                    title="Exámenes pendientes"
                  >
                    <span>📝</span>
                    <span className="text-sm">{pendingExams.length}</span>
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
                          const rankingBtnElement = document.querySelector('[data-tab="ranking"]')
                          if (rankingBtnElement) {
                            rankingBtnElement.click()
                          }
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
                          const rankingBtnElement = document.querySelector('[data-tab="ranking"]')
                          if (rankingBtnElement) {
                            rankingBtnElement.click()
                          }
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
                      const rachaBtnElement = document.querySelector('[data-tab="rachas"]')
                      if (rachaBtnElement) {
                        rachaBtnElement.click()
                      }
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
                    onClick={handleLinkClick}
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
      
      {/* Dropdown de exámenes pendientes */}
      {showPendingExamsDropdown && pendingExams.length > 0 && (
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
                  {pendingExams.length === 1 ? 'Examen pendiente' : `${pendingExams.length} exámenes pendientes`}
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
                const resumeUrl = `/auxiliar-administrativo-estado/test/tema/${exam.temaNumber || 1}/test-examen?resume=${exam.id}`

                return (
                  <Link
                    key={exam.id}
                    href={resumeUrl}
                    onClick={() => setShowPendingExamsDropdown(false)}
                    className="block p-3 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg border border-amber-200 dark:border-amber-700 transition-colors"
                  >
                    <div className="font-medium text-gray-800 dark:text-gray-200 truncate">
                      {exam.title || `Tema ${exam.temaNumber}`}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-amber-200 dark:bg-amber-800 rounded-full h-2">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {exam.answeredQuestions}/{exam.totalQuestions}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Click para continuar →
                    </div>
                  </Link>
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
        <FeedbackButton 
          onFeedbackSent={() => {
            // Refrescar notificaciones admin inmediatamente después de enviar feedback
            if (isAdmin && adminNotifications?.refresh) {
              adminNotifications.refresh()
            }
          }}
        />
      </div>

      {/* 💬 MODAL DE FEEDBACK */}
      <FeedbackModal 
        isOpen={showFeedbackModal} 
        onClose={() => setShowFeedbackModal(false)}
        onOpenQuestionDispute={() => {
          setShowQuestionDispute(true)
        }}
        onFeedbackSent={() => {
          // Refrescar notificaciones admin inmediatamente después de enviar feedback
          if (isAdmin && adminNotifications?.refresh) {
            adminNotifications.refresh()
          }
        }}
      />
      
      {/* Modal de QuestionDispute */}
      <QuestionDispute 
        questionId={null} // No tenemos questionId específico desde header
        user={user}
        supabase={supabase}
        isOpen={showQuestionDispute}
        onClose={() => setShowQuestionDispute(false)}
      />
      
    </>
  )
}