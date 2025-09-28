// app/Header.js - CORREGIDO - Enlaces funcionales sin errores 404
'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import UserAvatar from '@/components/UserAvatar'
import NotificationBell from '@/components/NotificationBell'
import { LogoHorizontal, LogoIcon } from '@/components/Logo'
import { useOposicion } from '../contexts/OposicionContext'
import { useAuth } from '../contexts/AuthContext'

export default function HeaderEN() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const pathname = usePathname()
  
  const { user, loading: authLoading, supabase } = useAuth()
  const oposicionContext = useOposicion()
  
  // Safe default values
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

  // 🆕 CHECK ADMIN STATUS
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
          console.error('Error checking admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(data === true)
        }
      } catch (err) {
        console.error('Error in admin verification:', err)
        setIsAdmin(false)
      } finally {
        setAdminLoading(false)
      }
    }

    if (!authLoading) {
      checkAdminStatus()
    }
  }, [user, supabase, authLoading])

  // 🔧 CORREGIDO: Detectar si estamos en página española y ajustar rutas
  const isSpanishContext = pathname.startsWith('/es')
  const langPrefix = isSpanishContext ? '' : '/es'

  // Simplified navigation links for logged in users
  const getLoggedInNavLinks = () => {
    if (!hasOposicion || loading) {
      return [
        { href: `${langPrefix}/auxiliar-administrativo-estado/test`, label: 'Tests', icon: '🎯' },
        { href: `${langPrefix}/auxiliar-administrativo-estado/temario`, label: 'Syllabus', icon: '📚' },
        { href: `${langPrefix}/auxiliar-administrativo-estado`, label: 'Exams', icon: '🔄' }  // ✅ Cambiado de /oposiciones
      ]
    }

    try {
      const featuredLink = oposicionMenu?.navLinks?.find(link => link?.featured)
      const basePath = featuredLink?.href || `${langPrefix}/auxiliar-administrativo-estado`
      
      return [
        { href: `${basePath}/test`, label: 'Tests', icon: '🎯' },
        { href: `${basePath}/temario`, label: 'Syllabus', icon: '📚' },
        { href: `${langPrefix}/auxiliar-administrativo-estado`, label: 'Exams', icon: '🔄' }  // ✅ Cambiado
      ]
    } catch (error) {
      console.warn('Error generating links:', error)
      return [
        { href: `${langPrefix}/auxiliar-administrativo-estado/test`, label: 'Tests', icon: '🎯' },
        { href: `${langPrefix}/auxiliar-administrativo-estado/temario`, label: 'Syllabus', icon: '📚' },
        { href: `${langPrefix}/auxiliar-administrativo-estado`, label: 'Exams', icon: '🔄' }  // ✅ Cambiado
      ]
    }
  }

  // 🔧 CORREGIDO: Navigation links for non-logged users con prefix correcto
  const getGuestNavLinks = () => {
    return [
      { href: `${langPrefix}/auxiliar-administrativo-estado/test`, label: 'Tests', icon: '🎯' },     // ✅ Agregado langPrefix
      { href: `${langPrefix}/auxiliar-administrativo-estado/temario`, label: 'Syllabus', icon: '📚' }, // ✅ Agregado langPrefix
      { href: `${langPrefix}/auxiliar-administrativo-estado`, label: 'Exams', icon: '🔄' }          // ✅ Cambiado de /oposiciones
    ]
  }

  // 🆕 MOBILE NAVIGATION LINKS (includes Admin if admin)
  const getMobileNavLinks = () => {
    const baseLinks = user ? getLoggedInNavLinks() : getGuestNavLinks()
    
    // Add Admin link if admin (always use /es/admin for consistency)
    if (user && isAdmin && !adminLoading) {
      return [
        ...baseLinks,
        { href: '/es/admin', label: 'Admin Panel', icon: '👨‍💼', isAdmin: true }  // ✅ Siempre /es/admin
      ]
    }
    
    return baseLinks
  }

  // Close menu when route changes
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

  // 🔧 CORREGIDO: Function to get tests link for the oposicion con prefix correcto
  const getTestsLink = () => {
    if (!user || !hasOposicion || loading) return `${langPrefix}/auxiliar-administrativo-estado/test`
    
    try {
      const featuredLink = oposicionMenu?.navLinks?.find(link => link?.featured)
      const basePath = featuredLink?.href || `${langPrefix}/auxiliar-administrativo-estado`
      return `${basePath}/test`
    } catch (error) {
      return `${langPrefix}/auxiliar-administrativo-estado/test`
    }
  }

  // Get dynamic color classes
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

  // Show loading while verifying auth
  if (authLoading) {
    return (
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            {/* Logo with loading - Responsive and bigger */}
            <div className="flex items-center">
              {/* Logo icon only on mobile - extra large with more space */}
              <div className="lg:hidden py-2">
                <div className="transform scale-150 origin-left">
                  <LogoIcon size={80} />
                </div>
              </div>
              {/* Horizontal logo only on desktop */}
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
            
            {/* LEFT: Bigger logo */}
            <div className="flex items-center">
              {/* Responsive logo - bigger on mobile */}
              <div className="flex items-center">
                {/* Logo icon only on mobile - extra large with more space */}
                <div className="lg:hidden py-2">
                  <div className="transform scale-150 origin-left">
                    <LogoIcon size={80} onClick={handleLinkClick} />
                  </div>
                </div>
                {/* Horizontal logo only on desktop - 25% bigger */}
                <div className="hidden lg:block">
                  <LogoHorizontal className="scale-125" onClick={handleLinkClick} />
                </div>
              </div>
            </div>
            
            {/* COMPLETE NAVIGATION DESKTOP */}
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

            {/* RIGHT: Admin + Notifications + Hamburger menu + User avatar */}
            <div className="flex items-center space-x-4">
              {/* 🔧 CORREGIDO: ADMIN LINK con ruta fija a /es/admin */}
              {user && isAdmin && !adminLoading && (
                <Link 
                  href="/es/admin"
                  className="hidden lg:flex items-center space-x-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 transition-colors text-red-700 hover:text-red-800"
                  title="Administration Panel"
                >
                  <span className="text-sm">👨‍💼</span>
                  <span className="text-sm font-medium">Admin</span>
                </Link>
              )}

              {/* Notification bell (logged users only) */}
              {user && <NotificationBell />}
              
              {/* Hamburger menu button with "Menu" text */}
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="lg:hidden flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mr-2"
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMobileMenuOpen}
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Menu</span>
                <div className="relative w-4 h-4 text-gray-700 dark:text-gray-300">
                  {isMobileMenuOpen ? (
                    <svg className="w-4 h-4 transition-transform duration-200 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </button>

              {/* User avatar */}
              <UserAvatar />
            </div>
          </div>

          {/* MOBILE MENU */}
          <div className={`lg:hidden absolute left-0 right-0 top-full bg-white dark:bg-gray-900 shadow-lg border-t border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ease-in-out ${
            isMobileMenuOpen 
              ? 'opacity-100 visible' 
              : 'opacity-0 invisible'
          }`}>
            <nav className="bg-white dark:bg-gray-900 p-4">
              
              {/* Mobile oposicion indicator (only if user logged in) */}
              {user && hasOposicion && !loading && oposicionMenu?.name && (
                <div className="mb-4 p-3 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/50 dark:to-cyan-900/50 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{oposicionMenu?.icon || '📚'}</span>
                    <div>
                      <div className="font-bold text-emerald-800 dark:text-emerald-200">Studying: {oposicionMenu?.name}</div>
                      <div className="text-sm text-emerald-600 dark:text-emerald-400">
                        {oposicionMenu?.badge && `Category ${oposicionMenu?.badge} • `}Quick access
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile navigation links */}
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
                        <div className="text-xs text-red-600 dark:text-red-400">Administration Panel</div>
                      )}
                    </div>
                    {(pathname === link.href || (link.isAdmin && pathname.startsWith('/es/admin'))) && (
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
        
        {/* Overlay to close mobile menu */}
        {isMobileMenuOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-40" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </header>

      {/* Welcome notification */}
      {showNotification && notificationData?.name && (
        <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-3 text-center relative">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-xl">🎉</span>
            <span className="font-medium">
              Perfect! Now you&apos;re studying: <strong>{notificationData.name}</strong>
            </span>
            <span className="text-sm opacity-90">• Quick access activated</span>
          </div>
          <button 
            onClick={dismissNotification}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}