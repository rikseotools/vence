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

export default function HeaderES() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [showRankingModal, setShowRankingModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showQuestionDispute, setShowQuestionDispute] = useState(false)
  const { hasNewMedals, newMedalsCount, markMedalsAsViewed } = useNewMedalsBadge()
  const pathname = usePathname()
  
  const { user, loading: authLoading, supabase } = useAuth()
  const oposicionContext = useOposicion()
  
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

  // Enlaces simplificados para usuarios logueados
  const getLoggedInNavLinks = () => {
    if (!hasOposicion || loading) {
      return [
        { href: '/auxiliar-administrativo-estado/test', label: 'Test', icon: '🎯' },
        { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
        { href: '/psicotecnicos/test', label: 'Psicotécnicos', icon: '🧩' },
        { href: '/oposiciones', label: 'Oposiciones', icon: '🔄' }
      ]
    }

    try {
      const featuredLink = oposicionMenu?.navLinks?.find(link => link?.featured)
      const basePath = featuredLink?.href || '/auxiliar-administrativo-estado'
      
      return [
        { href: `${basePath}/test`, label: 'Test', icon: '🎯' },
        { href: `${basePath}/temario`, label: 'Temario', icon: '📚' },
        { href: '/psicotecnicos/test', label: 'Psicotécnicos', icon: '🧩' },
        { href: '/oposiciones', label: 'Oposiciones', icon: '🔄' }
      ]
    } catch (error) {
      console.warn('Error generando enlaces:', error)
      return [
        { href: '/auxiliar-administrativo-estado/test', label: 'Test', icon: '🎯' },
        { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
        { href: '/psicotecnicos/test', label: 'Psicotécnicos', icon: '🧩' },
        { href: '/oposiciones', label: 'Oposiciones', icon: '🔄' }
      ]
    }
  }

  // Enlaces para usuarios NO logueados
  const getGuestNavLinks = () => {
    return [
      { href: '/auxiliar-administrativo-estado/test', label: 'Test', icon: '🎯' },
      { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/psicotecnicos', label: 'Psicotécnicos', icon: '🧠' },
      { href: '/oposiciones', label: 'Oposiciones', icon: '🔄' }
    ]
  }

  // 🆕 ENLACES PARA MÓVIL (incluye Admin si es admin)
  const getMobileNavLinks = () => {
    const baseLinks = user ? getLoggedInNavLinks() : getGuestNavLinks()
    
    // Agregar enlace de Admin si es admin
    if (user && isAdmin && !adminLoading) {
      return [
        ...baseLinks,
        { href: '/admin', label: 'Panel Admin', icon: '👨‍💼', isAdmin: true }
      ]
    }
    
    return baseLinks
  }

  // Cerrar menú cuando cambie la ruta
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false)
  }

  const toggleMobileMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Función para obtener el enlace a tests de la oposición
  const getTestsLink = () => {
    if (!user || !hasOposicion || loading) return '/auxiliar-administrativo-estado/test'
    
    try {
      const featuredLink = oposicionMenu?.navLinks?.find(link => link?.featured)
      const basePath = featuredLink?.href || '/auxiliar-administrativo-estado'
      return `${basePath}/test`
    } catch (error) {
      return '/auxiliar-administrativo-estado/test'
    }
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
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            {/* Logo con loading - Responsive y más grande */}
            <div className="flex items-center">
              {/* Logo solo icono en móvil - extra grande con más espacio */}
              <div className="lg:hidden py-3">
                  <LogoIcon size={48} onClick={handleLinkClick} />
              </div>
              {/* Logo horizontal solo en desktop */}
              <div className="hidden lg:block">
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
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            
            {/* IZQUIERDA: Logo más pequeño en móvil */}
            <div className="flex items-center flex-shrink-0">
              {/* Logo responsive - más pequeño en móvil */}
              <div className="flex items-center">
                {/* Logo solo icono en móvil - tamaño reducido */}
                <div className="lg:hidden py-1">
                    <LogoIcon size={48} onClick={handleLinkClick} />
                </div>
                {/* Logo horizontal solo en desktop - 25% más grande */}
                <div className="hidden lg:block">
                  <LogoHorizontal className="scale-125" onClick={handleLinkClick} />
                </div>
              </div>
            </div>
            
            {/* NAVEGACIÓN COMPLETA DESKTOP */}
            <nav className="hidden lg:flex items-center justify-center flex-1 mx-8">
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

            {/* DERECHA: Admin + Notificaciones + Menú hamburguesa + Avatar del usuario */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              {/* 🆕 ENLACE DE ADMIN (solo desktop y solo si es admin) */}
              {user && isAdmin && !adminLoading && (
                <Link 
                  href="/admin"
                  className="hidden lg:flex items-center space-x-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 transition-colors text-red-700 hover:text-red-800"
                  title="Panel de Administración"
                >
                  <span className="text-sm">👨‍💼</span>
                  <span className="text-sm font-medium">Admin</span>
                </Link>
              )}

              {/* 💬 BOTÓN DE FEEDBACK - Solo en desktop */}
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="hidden lg:flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors text-blue-700 hover:text-blue-800"
                title="Enviar feedback"
              >
                <span className="text-sm">💬</span>
                <span className="text-sm font-medium">Feedback</span>
              </button>

              {/* Icono de ranking/liga (solo usuarios logueados) */}
              {user && (
                <>
                  {hasNewMedals ? (
                    // Botón con trofeo parpadeante cuando hay medallas nuevas
                    <button
                      onClick={async () => {
                        setShowRankingModal(true)
                        await markMedalsAsViewed()
                      }}
                      className="relative p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                      aria-label="Ver ranking de usuarios"
                      title={`Ranking y Liga - ${newMedalsCount} medalla(s) nueva(s)`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      
                      {/* Trofeo parpadeante como antes */}
                      <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        🏆
                      </span>
                    </button>
                  ) : (
                    // Botón normal sin trofeo cuando no hay medallas nuevas
                    <button
                      onClick={() => setShowRankingModal(true)}
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
                </>
              )}

              {/* 🎯 ICONO DE DIANA PARA TESTS - Solo en móvil */}
              {user && (
                <Link
                  href="/auxiliar-administrativo-estado/test"
                  className="lg:hidden p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                  aria-label="Ir a Tests"
                  title="Tests de Práctica"
                >
                  <span className="text-2xl">🎯</span>
                </Link>
              )}
              
              {/* Campana de notificaciones (solo usuarios logueados) */}
              {user && <NotificationBell />}
              
              {/* Botón menú hamburguesa con texto "Menú" */}
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="lg:hidden flex items-center space-x-1 px-2 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
          <div className={`lg:hidden absolute left-0 right-0 top-full bg-white dark:bg-gray-900 shadow-lg border-t border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ease-in-out ${
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
                    <div className="flex-1">
                      <span className="text-lg font-medium">{link.label}</span>
                      {link.isAdmin && (
                        <div className="text-xs text-red-600 dark:text-red-400">Panel de Administración</div>
                      )}
                    </div>
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
            className="lg:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-40" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </header>

      {/* Notificación de bienvenida */}
      {showNotification && notificationData?.name && (
        <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-3 text-center relative">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-xl">🎉</span>
            <span className="font-medium">
              ¡Perfecto! Ahora estudias: <strong>{notificationData.name}</strong>
            </span>
            <span className="text-sm opacity-90">• Acceso rápido activado</span>
          </div>
          <button 
            onClick={dismissNotification}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Modal de ranking */}
      <RankingModal 
        isOpen={showRankingModal} 
        onClose={() => setShowRankingModal(false)} 
      />

      {/* 💬 BOTÓN DE FEEDBACK FLOTANTE */}
      <FeedbackButton />

      {/* 💬 MODAL DE FEEDBACK */}
      <FeedbackModal 
        isOpen={showFeedbackModal} 
        onClose={() => setShowFeedbackModal(false)}
        onOpenQuestionDispute={() => {
          setShowQuestionDispute(true)
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