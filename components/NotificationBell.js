// components/NotificationBell.js - SISTEMA CON INDICADORES ÚTILES Y COMPORTAMIENTO MEJORADO
'use client'
import { useState, useEffect, useRef } from 'react'
import { useIntelligentNotifications } from '../hooks/useIntelligentNotifications'
import { useDisputeNotifications } from '../hooks/useDisputeNotifications'
import { getActionTimeEstimate, getActionIcon } from '../hooks/useIntelligentNotifications'

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    categorizedNotifications,
    markAsRead,
    dismissNotification,
    loadAllNotifications,
    executeAction,              
    getNotificationActions,     
    notificationTypes
  } = useIntelligentNotifications()

  // Hook para impugnaciones/disputas
  const disputeNotifications = useDisputeNotifications()

  // Estados locales
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isDesktop, setIsDesktop] = useState(false)
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)
  
  // Estados para alegaciones
  const [showingAppealForm, setShowingAppealForm] = useState(null) // ID de la disputa
  const [appealText, setAppealText] = useState('')
  const [submittingAppeal, setSubmittingAppeal] = useState(false)

  // Detectar tamaño de pantalla
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  // Cerrar al hacer scroll en móvil
  useEffect(() => {
    function handleScroll() {
      if (isOpen) setIsOpen(false)
    }

    if (isOpen) {
      window.addEventListener('scroll', handleScroll)
    }

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isOpen])

  // 🆕 MANEJAR ALEGACIÓN DE IMPUGNACIÓN RECHAZADA
  const handleSubmitAppeal = async (disputeId) => {
    if (!appealText.trim() || submittingAppeal) return
    
    setSubmittingAppeal(true)
    
    try {
      const success = await disputeNotifications.submitAppeal(disputeId, appealText)
      
      if (success) {
        setAppealText('')
        setShowingAppealForm(null)
        // Mostrar mensaje de éxito
        console.log('✅ Alegación enviada correctamente')
      } else {
        console.error('❌ Error enviando alegación')
      }
    } catch (error) {
      console.error('Error enviando alegación:', error)
    } finally {
      setSubmittingAppeal(false)
    }
  }

  const handleShowAppealForm = (disputeId) => {
    setShowingAppealForm(disputeId)
    setAppealText('')
  }

  const handleCancelAppeal = () => {
    setShowingAppealForm(null)
    setAppealText('')
  }

  // 🆕 MANEJAR ACCIÓN CON COMPORTAMIENTO DIFERENCIADO
  const handleActionClick = async (notification, actionType, event) => {
    event.stopPropagation()
    
    const notificationType = notificationTypes[notification.type]
    if (!notificationType) return

    const action = actionType === 'primary' 
      ? notificationType.primaryAction 
      : notificationType.secondaryAction

    if (!action) return

    try {
      if (actionType === 'primary') {
        // ✅ ACCIÓN PRIMARIA: Manejar según tipo de notificación
        if (notification.type === 'dispute_update') {
          // 🆕 IMPUGNACIONES: Marcar como leído Y navegar
          await disputeNotifications.markAsRead(notification.id)
          
          // Generar URL y navegar
          const actionUrl = generateActionUrl(notification, action.type)
          setTimeout(() => {
            window.location.href = actionUrl
          }, 200)
        } else if (notification.type === 'feedback_response') {
          // 💬 FEEDBACK: Marcar como leído Y abrir chat
          await markAsRead(notification.id)
          
          const actionUrl = generateActionUrl(notification, action.type)
          setTimeout(() => {
            window.location.href = actionUrl
          }, 200)
        } else {
          // OTRAS NOTIFICACIONES: Comportamiento normal (ocultar)
          await executeAction(notification, actionType)
        }
      } else {
        // 👁️ ACCIÓN SECUNDARIA: Solo navegar (problema persiste)
        
        // Generar URL y navegar sin ocultar
        const actionUrl = generateActionUrl(notification, action.type)
        setTimeout(() => {
          window.location.href = actionUrl
        }, 200)
      }
    } catch (error) {
      // Error silencioso en producción
    }
    
    // Cerrar dropdown
    setIsOpen(false)
  }

  // 🆕 GENERAR URL DE ACCIÓN (copiada del hook para uso local)
  const generateActionUrl = (notification, actionType) => {
    console.log('🔍 generateActionUrl called:', { type: notification.type, actionType, notification })
    const baseParams = new URLSearchParams({
      utm_source: 'notification',
      utm_campaign: notification.campaign || 'general',
      notification_id: notification.id
    })
    
    try {
      switch (notification.type) {
        case 'problematic_articles':
          if (actionType === 'intensive_test') {
            const articles = notification.articlesList?.map(a => a.article_number).join(',') || ''
            const lawSlug = generateLawSlug(notification.law_short_name)
            baseParams.append('articles', articles)
            baseParams.append('mode', 'intensive')
            baseParams.append('n', Math.min(notification.articlesCount * 2, 10).toString())
            
            return `/test/${encodeURIComponent(lawSlug)}/articulos-dirigido?${baseParams.toString()}`
          } else if (actionType === 'view_theory') {
            const lawSlug = generateLawSlug(notification.law_short_name)
            return `/teoria/${lawSlug}?${baseParams.toString()}`
          }
          break
          
        case 'level_regression':
          if (actionType === 'directed_test') {
            const lawSlug = generateLawSlug(notification.law_short_name)
            baseParams.append('mode', 'recovery')
            baseParams.append('n', '15')
            
            return `/test/${encodeURIComponent(lawSlug)}/test-rapido?${baseParams.toString()}`
          } else if (actionType === 'view_theory') {
            const lawSlug = generateLawSlug(notification.law_short_name)
            return `/teoria/${lawSlug}?${baseParams.toString()}`
          }
          break
          
        case 'study_streak':
          if (actionType === 'maintain_streak') {
            baseParams.append('mode', 'streak')
            baseParams.append('n', '5')
            
            return `/test/mantener-racha?${baseParams.toString()}`
          } else if (actionType === 'view_streak_stats') {
            return `/mis-estadisticas?${baseParams.toString()}`
          }
          break
          
        case 'achievement':
        case 'improvement':
          if (actionType === 'next_challenge' || actionType === 'consolidate_improvement') {
            baseParams.append('mode', 'celebration')
            baseParams.append('n', '8')
            
            return `/test/rapido?${baseParams.toString()}`
          } else if (actionType === 'view_achievements' || actionType === 'view_progress') {
            return `/mis-estadisticas?${baseParams.toString()}`
          }
          break
          
        case 'streak_broken':
          if (actionType === 'quick_test') {
            baseParams.append('mode', 'recovery')
            baseParams.append('n', '5')
            
            return `/test/rapido?${baseParams.toString()}`
          } else if (actionType === 'view_stats') {
            return `/mis-estadisticas?${baseParams.toString()}`
          }
          break
          
        case 'progress_update':
          if (actionType === 'advanced_test') {
            return `/test/rapido?${baseParams.toString()}`
          } else if (actionType === 'view_details') {
            return `/mis-estadisticas?${baseParams.toString()}`
          }
          break
          
        case 'dispute_update':
          console.log('🔍 Dispute case - actionType:', actionType, 'notification:', notification)
          if (actionType === 'view_dispute') {
            // Ir a la página de soporte/impugnaciones con la disputa específica
            const disputeId = notification.disputeId || notification.id.replace('dispute-', '') || notification.id
            console.log('✅ Generated dispute URL with disputeId:', disputeId)
            return `/soporte?tab=impugnaciones&dispute_id=${disputeId}&${baseParams.toString()}`
          }
          break

        case 'feedback_response':
          if (actionType === 'open_chat') {
            return `/soporte?conversation_id=${notification.context_data?.conversation_id || notification.data?.conversation_id}`
          }
          break
          
        default:
          return `/test/rapido?${baseParams.toString()}`
      }
    } catch (error) {
      return `/test/rapido?${baseParams.toString()}`
    }
    
    return `/test/rapido?${baseParams.toString()}`
  }

  // 🆕 GENERAR SLUG DE LEY (copiada del hook)
  const generateLawSlug = (lawName) => {
    if (!lawName) return 'unknown'
    
    const specialCases = {
      'Ley 19/2013': 'ley-19-2013',
      'Ley 50/1997': 'ley-50-1997',
      'Ley 40/2015': 'ley-40-2015',
      'LRJSP': 'ley-40-2015',
      'Ley 7/1985': 'ley-7-1985',
      'Ley 2/2014': 'ley-2-2014',
      'Ley 25/2014': 'ley-25-2014',
      'Ley 38/2015': 'ley-38-2015',
      'LPAC': 'ley-39-2015',
      'CE': 'ce',
      'Constitución Española': 'ce',
      'TUE': 'tue',
      'TFUE': 'tfue'
    }
    
    if (specialCases[lawName]) {
      return specialCases[lawName]
    }
    
    return lawName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  // Manejar botón "Marcar como leído" (solo impugnaciones)
  const handleMarkAsRead = (notification, event) => {
    event.stopPropagation()
    
    console.log('🔍 handleMarkAsRead llamado:', { 
      type: notification.type, 
      id: notification.id, 
      disputeId: notification.disputeId 
    })
    
    // Si es una notificación de disputa, usar el hook de disputas
    if (notification.type === 'dispute_update') {
      disputeNotifications.markAsRead(notification.id)
    } else {
      markAsRead(notification.id)
    }
  }

  // Manejar botón "Entendido" (descartar otras notificaciones)
  const handleDismiss = (notification, event) => {
    event.stopPropagation()
    dismissNotification(notification.id)
  }

  // Recargar notificaciones
  const handleRefresh = () => {
    loadAllNotifications()
    disputeNotifications.refreshNotifications() // Refrescar también las disputas
  }

  // 🆕 MEZCLAR NOTIFICACIONES DE DISPUTAS CON NOTIFICACIONES PRINCIPALES
  const getAllNotifications = () => {
    // Combinar notificaciones principales con disputas
    const combinedNotifications = [
      ...notifications,
      ...(disputeNotifications.notifications || [])
    ]
    
    // Ordenar por timestamp (más recientes primero)
    return combinedNotifications.sort((a, b) => 
      new Date(b.timestamp || b.resolved_at || 0) - new Date(a.timestamp || a.resolved_at || 0)
    )
  }

  // Filtrar notificaciones según categoría seleccionada
  const getFilteredNotifications = () => {
    const allNotifications = getAllNotifications()
    
    if (selectedCategory === 'all') {
      return allNotifications
    }
    
    // Filtrar por categoría - las disputas van en 'important'
    const disputeNotifs = disputeNotifications.notifications || []
    const mainNotifs = categorizedNotifications[selectedCategory] || []
    
    if (selectedCategory === 'important') {
      return [...mainNotifs, ...disputeNotifs]
    }
    
    return mainNotifs
  }

  // 🆕 CALCULAR TOTAL DE NOTIFICACIONES NO LEÍDAS INCLUYENDO DISPUTAS
  const getTotalUnreadCount = () => {
    const mainUnread = unreadCount || 0
    const disputeUnread = disputeNotifications.unreadCount || 0
    return mainUnread + disputeUnread
  }

  // Obtener color del badge según la prioridad máxima
  const getBadgeColor = () => {
    // Si hay disputas no leídas, prioridad alta
    if ((disputeNotifications.unreadCount || 0) > 0) return 'bg-red-500'
    if (categorizedNotifications.critical.length > 0) return 'bg-red-500'
    if (categorizedNotifications.important.length > 0) return 'bg-orange-500'
    if (categorizedNotifications.recommendations.length > 0) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  // Siempre mostrar la campana, incluso si está cargando
  // if (loading && notifications.length === 0) return null

  const filteredNotifications = getFilteredNotifications()

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
        aria-label={`Notificaciones ${getTotalUnreadCount() > 0 ? `(${getTotalUnreadCount()} nuevas)` : ''}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {/* Badge de notificaciones */}
        {getTotalUnreadCount() > 0 && (
          <span className={`absolute -top-1 -right-1 ${getBadgeColor()} text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse`}>
            {getTotalUnreadCount() > 9 ? '9+' : getTotalUnreadCount()}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {isOpen && (
        <>
          {/* Overlay para móvil */}
          <div 
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel de notificaciones */}
          <div 
            ref={dropdownRef}
            className={`z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 overflow-y-auto ${
              isDesktop 
                ? 'absolute right-0 mt-2 w-[420px] max-h-96'
                : 'fixed top-16 right-2 left-2 w-auto max-h-[75vh]'
            }`}
          >
            {/* Header del panel */}
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-t-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">
                  🔔 Notificaciones Inteligentes
                </h3>
                <div className="flex items-center space-x-2">
                  {getTotalUnreadCount() > 0 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                      {getTotalUnreadCount()} nuevas
                    </span>
                  )}
                  {/* Botón refrescar */}
                  <button
                    onClick={handleRefresh}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                    title="Actualizar notificaciones"
                  >
                    🔄
                  </button>
                  {/* Botón cerrar en móvil */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="lg:hidden p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                    aria-label="Cerrar notificaciones"
                  >
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Filtros por categoría */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`text-xs px-2 py-1 rounded-full transition-colors ${
                    selectedCategory === 'all' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  Todas ({getAllNotifications().length})
                </button>
                {categorizedNotifications.critical.length > 0 && (
                  <button
                    onClick={() => setSelectedCategory('critical')}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      selectedCategory === 'critical' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50'
                    }`}
                  >
                    🔴 Críticas ({categorizedNotifications.critical.length})
                  </button>
                )}
                {categorizedNotifications.important.length > 0 && (
                  <button
                    onClick={() => setSelectedCategory('important')}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      selectedCategory === 'important' 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50'
                    }`}
                  >
                    🟠 Importantes ({categorizedNotifications.important.length})
                  </button>
                )}
                {categorizedNotifications.recommendations.length > 0 && (
                  <button
                    onClick={() => setSelectedCategory('recommendations')}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      selectedCategory === 'recommendations' 
                        ? 'bg-yellow-600 text-white' 
                        : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800/50'
                    }`}
                  >
                    🟡 Logros ({categorizedNotifications.recommendations.length})
                  </button>
                )}
                {categorizedNotifications.info.length > 0 && (
                  <button
                    onClick={() => setSelectedCategory('info')}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      selectedCategory === 'info' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50'
                    }`}
                  >
                    🔵 Info ({categorizedNotifications.info.length})
                  </button>
                )}
              </div>
            </div>

            {/* Contenido del panel */}
            <div className="max-h-80 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-3">
                    {selectedCategory === 'all' ? '🔕' : 
                     selectedCategory === 'critical' ? '🔴' :
                     selectedCategory === 'important' ? '🟠' :
                     selectedCategory === 'recommendations' ? '🟡' : '🔵'}
                  </div>
                  <p className="text-sm">
                    {selectedCategory === 'all' 
                      ? 'No hay notificaciones recientes' 
                      : `No hay notificaciones ${selectedCategory === 'critical' ? 'críticas' : 
                                                selectedCategory === 'important' ? 'importantes' :
                                                selectedCategory === 'recommendations' ? 'de logros' : 'informativas'}`}
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Comprobar actualizaciones
                  </button>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  // 🆕 OBTENER ACCIONES ESPECÍFICAS PARA ESTA NOTIFICACIÓN
                  let actions
                  
                  if (notification.type === 'dispute_update') {
                    // Acciones específicas para impugnaciones
                    actions = {
                      primary: {
                        type: 'view_dispute',
                        label: '📋 Ver Impugnación'
                      }
                    }
                  } else {
                    actions = getNotificationActions(notification)
                  }
                  
                  return (
                    <div 
                      key={notification.id} 
                      className={`p-4 border-b dark:border-gray-700 transition-colors ${
                        !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`w-8 h-8 ${notification.bgColor} rounded-full flex items-center justify-center`}>
                            <span className={`${notification.textColor} text-sm`}>{notification.icon}</span>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                              {notification.title}
                            </p>
                            <div className="flex items-center space-x-2 ml-2">
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                              )}
                              {/* Botón X para cerrar/marcar como leído */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  console.log('🔍 Clic en X - notification:', { 
                                    type: notification.type, 
                                    id: notification.id, 
                                    disputeId: notification.disputeId 
                                  })
                                  // Para impugnaciones, marcar como leído en BD. Para otras, solo ocultar.
                                  if (notification.type === 'dispute_update') {
                                    disputeNotifications.markAsRead(notification.id)
                                  } else {
                                    handleDismiss(notification, e)
                                  }
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-100 dark:bg-gray-600 dark:hover:bg-red-900/50 transition-colors text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 shadow-sm hover:shadow-md"
                                title={notification.type === 'dispute_update' ? "Marcar como leído" : "Cerrar notificación"}
                                aria-label="Cerrar notificación"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                            {notification.message}
                          </p>
                          
                          {/* 🆕 BOTONES DE ACCIÓN ESPECÍFICOS */}
                          <div className="flex flex-col gap-2 mb-3">
                            {/* Acción Principal */}
                            {actions.primary && (
                              <button
                                onClick={(e) => handleActionClick(notification, 'primary', e)}
                                className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors group touch-manipulation"
                              >
                                <span className="mr-2">{getActionIcon(actions.primary.type)}</span>
                                {actions.primary.label}
                                {getActionTimeEstimate(actions.primary.type) && actions.primary.type !== 'intensive_test' && actions.primary.type !== 'open_chat' && (
                                  <span className="ml-2 text-blue-200 text-xs">
                                    ({getActionTimeEstimate(actions.primary.type)})
                                  </span>
                                )}
                              </button>
                            )}
                            
                            {/* Acciones Secundarias */}
                            <div className="flex flex-col sm:flex-row gap-2">
                              {/* Solo mostrar acciones secundarias para notificaciones que NO sean de disputas */}
                              {notification.type !== 'dispute_update' && actions.secondary && (
                                <button
                                  onClick={(e) => handleActionClick(notification, 'secondary', e)}
                                  className="w-full sm:flex-1 bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border border-blue-300 dark:border-blue-600 touch-manipulation"
                                >
                                  <span className="mr-1">{getActionIcon(actions.secondary.type)}</span>
                                  {actions.secondary.label}
                                </button>
                              )}
                              
                              {/* Botón Contestar para impugnaciones rechazadas */}
                              {notification.type === 'dispute_update' && notification.status === 'rejected' && notification.canAppeal && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleShowAppealForm(notification.disputeId)
                                  }}
                                  className="w-full sm:flex-1 px-3 py-2.5 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-lg text-sm hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors border border-orange-300 dark:border-orange-600 touch-manipulation"
                                  title="Contestar impugnación rechazada"
                                >
                                  📝 Contestar
                                </button>
                              )}
                              
                              {/* Botón Marcar como leído / Entendido - SOLO para notificaciones que NO sean de disputas */}
                              {notification.type === 'feedback_response' ? (
                                // Para feedback: No mostrar botón (se marca como leído automáticamente al abrir chat)
                                null
                              ) : notification.type !== 'dispute_update' ? (
                                // Para otras (no disputas): Entendido (descartar)
                                <button
                                  onClick={(e) => handleDismiss(notification, e)}
                                  className="w-full sm:flex-1 px-3 py-2.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg text-sm hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors border border-green-300 dark:border-green-600 touch-manipulation"
                                  title="Ocultar esta notificación"
                                >
                                  Marcar como leído
                                </button>
                              ) : null}
                            </div>
                          </div>
                          
                          {/* 🆕 INDICADORES ÚTILES ESPECÍFICOS POR TIPO */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            {/* 📊 Información específica por tipo de notificación */}
                            <div className="flex items-center space-x-2 flex-wrap">
                              {notification.article && (
                                <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                                  {notification.article}
                                </span>
                              )}
                              
                              {/* 🚨 Indicador de urgencia para artículos problemáticos */}
                              {notification.type === 'problematic_articles' && notification.accuracy < 50 && (
                                <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
                                  🚨 Urgente
                                </span>
                              )}
                              
                              {/* 🔥 Indicador de progreso para rachas */}
                              {notification.type === 'study_streak' && notification.streak_days && (
                                <span className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full">
                                  🔥 {notification.streak_days} días
                                </span>
                              )}
                              
                              {/* 🏆 Indicador de logro */}
                              {notification.type === 'achievement' && (
                                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full">
                                  🏆 Nuevo logro
                                </span>
                              )}
                              
                            </div>
                            
                            {/* ⏰ Timestamp limpio */}
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(notification.timestamp).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Europe/Madrid'
                              })}
                            </p>
                          </div>
                          
                          {/* 📈 Mostrar detalles específicos según tipo */}
                          {notification.type === 'problematic_articles' && notification.accuracy && (
                            <div className="mb-2 text-xs">
                              <span className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
                                📉 {notification.accuracy}% aciertos
                              </span>
                              {notification.attempts && (
                                <span className="ml-2 text-gray-500 dark:text-gray-400">
                                  ({notification.attempts} intentos)
                                </span>
                              )}
                            </div>
                          )}

                          {/* 📚 Mostrar detalles de artículos múltiples */}
                          {notification.articlesList && notification.articlesList.length > 1 && (
                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                              <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                                📋 {notification.articlesList.length} artículos problemáticos:
                              </div>
                              {notification.articlesList.slice(0, 3).map((article, idx) => (
                                <div key={idx} className="text-gray-600 dark:text-gray-400">
                                  • Art. {article.article_number}: {article.accuracy_percentage}% aciertos
                                </div>
                              ))}
                              {notification.articlesList.length > 3 && (
                                <div className="text-gray-500 dark:text-gray-500 mt-1">
                                  📝 ... y {notification.articlesList.length - 3} más
                                </div>
                              )}
                            </div>
                          )}

                          {/* 🆕 FORMULARIO DE ALEGACIÓN */}
                          {showingAppealForm === notification.disputeId && (
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                  📝 Contestar Impugnación
                                </h4>
                                <button
                                  onClick={handleCancelAppeal}
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="mb-3">
                                <textarea
                                  value={appealText}
                                  onChange={(e) => setAppealText(e.target.value)}
                                  placeholder="Explica por qué consideras que la impugnación debería ser reconsiderada..."
                                  className="w-full p-3 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                  rows={4}
                                  maxLength={1000}
                                />
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {appealText.length}/1000 caracteres
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleCancelAppeal}
                                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => handleSubmitAppeal(notification.disputeId)}
                                  disabled={!appealText.trim() || submittingAppeal}
                                  className="flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {submittingAppeal ? (
                                    <span className="flex items-center justify-center">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-2"></div>
                                      Enviando...
                                    </span>
                                  ) : (
                                    '📤 Enviar Alegación'
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer del panel */}
            {filteredNotifications.length > 0 && (
              <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedCategory === 'all' 
                      ? `${getAllNotifications().length} notificaciones totales`
                      : `${filteredNotifications.length} en esta categoría`}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        window.location.href = '/soporte'
                      }}
                      className="text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium py-1 px-3 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                    >
                      🎧 Soporte →
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        window.location.href = '/mis-estadisticas'
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium py-1 px-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      📊 Estadísticas →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}