// lib/services/notificationTracker.js - SERVICIO PARA TRACKING DE NOTIFICACIONES
'use client'
import { getSupabaseClient } from '../supabase'

// Instancia global de Supabase
let supabaseInstance = null

// Detectar información del dispositivo y navegador
const getDeviceInfo = () => {
  if (typeof window === 'undefined') return {}
  
  const ua = navigator.userAgent
  const platform = navigator.platform
  
  return {
    platform: platform,
    userAgent: ua,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    language: navigator.language,
    languages: navigator.languages,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory || null,
    connection: navigator.connection ? {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt
    } : null
  }
}

// Detectar información del navegador
const getBrowserInfo = () => {
  if (typeof window === 'undefined') return {}
  
  const ua = navigator.userAgent
  let browserName = 'Unknown'
  let browserVersion = 'Unknown'
  
  // Detectar navegador
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    browserName = 'Chrome'
    browserVersion = ua.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown'
  } else if (ua.includes('Firefox')) {
    browserName = 'Firefox'
    browserVersion = ua.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown'
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browserName = 'Safari'
    browserVersion = ua.match(/Safari\/([0-9.]+)/)?.[1] || 'Unknown'
  } else if (ua.includes('Edg')) {
    browserName = 'Edge'
    browserVersion = ua.match(/Edg\/([0-9.]+)/)?.[1] || 'Unknown'
  }
  
  return {
    name: browserName,
    version: browserVersion,
    userAgent: ua,
    vendor: navigator.vendor,
    appName: navigator.appName,
    appVersion: navigator.appVersion,
    product: navigator.product
  }
}

// Obtener IP del usuario (usando servicio externo)
const getUserIP = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch (error) {
    console.warn('No se pudo obtener IP:', error)
    return null
  }
}

class NotificationTracker {
  constructor() {
    this.deviceInfo = getDeviceInfo()
    this.browserInfo = getBrowserInfo()
    this.userIP = null
    this.initIP()
    this.setupServiceWorkerListener()
  }

  // Método para obtener instancia de Supabase (permite inyección desde contexto)
  getSupabase() {
    return supabaseInstance || getSupabaseClient()
  }

  // Método para configurar instancia desde el contexto de Auth
  setSupabaseInstance(supabase) {
    supabaseInstance = supabase
  }

  async initIP() {
    this.userIP = await getUserIP()
  }

  // Escuchar mensajes del service worker
  setupServiceWorkerListener() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'TRACK_NOTIFICATION_EVENT') {
          this.handleServiceWorkerTrackingEvent(event.data.eventType, event.data.data)
        }
      })
    }
  }

  // Manejar eventos de tracking del service worker
  async handleServiceWorkerTrackingEvent(eventType, eventData) {
    try {
      const supabase = this.getSupabase()
      const { user } = await supabase.auth.getUser()
      if (!user?.data?.user) {
        console.warn('No hay usuario autenticado para tracking desde SW')
        return
      }

      // Combinar datos del SW con datos del tracker
      const fullEventData = {
        user_id: user.data.user.id,
        ...eventData,
        ip_address: this.userIP
      }

      const { error } = await supabase
        .from('notification_events')
        .insert(fullEventData)

      if (error) {
        console.error('Error tracking SW event:', error)
      } else {
        console.log(`📊 SW event tracked: ${eventType}`)
      }
    } catch (error) {
      console.error('Error handling SW tracking event:', error)
    }
  }

  // Registrar evento de notificación push con información mejorada
  async trackPushEvent(eventType, userData = null, data = {}) {
    try {
      const supabase = this.getSupabase()
      
      // Usar usuario pasado como parámetro o intentar obtenerlo
      let user = userData
      if (!user) {
        const { user: authUser } = await supabase.auth.getUser()
        user = authUser?.data?.user
      }
      
      if (!user) {
        console.warn('No hay usuario autenticado para tracking')
        return
      }

      // Obtener información específica del dispositivo
      const deviceType = this.getDeviceType()
      const mobileInfo = this.getMobileInfo()
      
      const eventData = {
        user_id: user.id || user.data?.user?.id,
        event_type: eventType,
        notification_type: data.notificationType || null,
        device_info: {
          ...this.deviceInfo,
          deviceType,
          mobileInfo,
          timestamp: Date.now()
        },
        browser_info: {
          ...this.browserInfo,
          timestamp: Date.now()
        },
        push_subscription: data.subscription || null,
        notification_data: {
          title: data.title,
          body: data.body,
          tag: data.tag,
          icon: data.icon,
          badge: data.badge,
          actions: data.actions,
          ...data.customData
        },
        response_time_ms: data.responseTime || null,
        error_details: data.error ? {
          message: data.error,
          name: data.errorName || null,
          stack: data.errorStack || null,
          deviceType,
          currentPermission: data.currentPermission || null,
          apiSupport: {
            serviceWorker: data.serviceWorkerSupported || false,
            pushManager: data.pushManagerSupported || false,
            notification: mobileInfo.hasNotificationAPI
          }
        } : null,
        ip_address: this.userIP,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null
      }

      const { error } = await supabase
        .from('notification_events')
        .insert(eventData)

      if (error) {
        console.error('Error tracking push event:', error)
      } else {
        console.log(`📊 Push event tracked: ${eventType} [${deviceType}]`)
      }
    } catch (error) {
      console.error('Error in trackPushEvent:', error)
    }
  }

  // Registrar evento de email
  async trackEmailEvent(eventType, data = {}) {
    try {
      const supabase = this.getSupabase()
      const { user } = await supabase.auth.getUser()
      if (!user?.data?.user) {
        console.warn('No hay usuario autenticado para tracking de email')
        return
      }

      const eventData = {
        user_id: user.data.user.id,
        email_type: data.emailType || 'unknown',
        event_type: eventType,
        email_address: data.emailAddress || user.data.user.email,
        subject: data.subject || null,
        template_id: data.templateId || null,
        campaign_id: data.campaignId || null,
        email_content_preview: data.contentPreview || null,
        link_clicked: data.linkClicked || null,
        click_count: data.clickCount || 0,
        open_count: data.openCount || 0,
        device_type: this.getDeviceType(),
        client_name: data.clientName || this.getEmailClient(),
        ip_address: this.userIP,
        user_agent: navigator.userAgent,
        geolocation: data.geolocation || {},
        error_details: data.error || null
      }

      const { error } = await supabase
        .from('email_events')
        .insert(eventData)

      if (error) {
        console.error('Error tracking email event:', error)
      } else {
        console.log(`📧 Email event tracked: ${eventType}`)
      }
    } catch (error) {
      console.error('Error in trackEmailEvent:', error)
    }
  }

  // Determinar tipo de dispositivo con más detalles
  getDeviceType() {
    if (typeof window === 'undefined') return 'unknown'
    
    const ua = navigator.userAgent.toLowerCase()
    
    // Detectar iOS específicamente
    if (/iphone|ipod/.test(ua)) {
      return 'ios_mobile'
    }
    if (/ipad/.test(ua)) {
      return 'ios_tablet'
    }
    
    // Detectar Android específicamente
    if (/android/.test(ua)) {
      if (/mobile/.test(ua)) {
        return 'android_mobile'
      } else {
        return 'android_tablet'
      }
    }
    
    // Otros tablets
    if (/tablet|playbook|silk/.test(ua)) {
      return 'tablet'
    }
    
    // Otros móviles
    if (/mobile|blackberry|opera.*mini|windows.*ce|palm|smartphone|iemobile/.test(ua)) {
      return 'mobile'
    }
    
    // Desktop
    return 'desktop'
  }

  // Obtener información específica del dispositivo móvil
  getMobileInfo() {
    if (typeof window === 'undefined') return {}
    
    const ua = navigator.userAgent
    
    return {
      isStandalone: window.navigator.standalone === true, // PWA en iOS
      isTouchDevice: 'ontouchstart' in window,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      screenOrientation: screen.orientation?.type || 'unknown',
      pixelRatio: window.devicePixelRatio || 1,
      isFullscreen: window.innerHeight === screen.height,
      hasNotificationAPI: 'Notification' in window,
      hasServiceWorkerAPI: 'serviceWorker' in navigator,
      hasPushManagerAPI: 'PushManager' in window,
      notificationPermission: 'Notification' in window ? Notification.permission : 'unsupported'
    }
  }

  // Detectar cliente de email (aproximado)
  getEmailClient() {
    const ua = navigator.userAgent
    if (ua.includes('Outlook')) return 'Outlook'
    if (ua.includes('Gmail')) return 'Gmail'
    if (ua.includes('Yahoo')) return 'Yahoo'
    if (ua.includes('Apple Mail')) return 'Apple Mail'
    return 'Unknown'
  }

  // Métodos específicos para cada evento de push

  // Cuando se solicitan permisos
  async trackPermissionRequested(user = null) {
    await this.trackPushEvent('permission_requested', user)
  }

  // Cuando se otorgan permisos
  async trackPermissionGranted(user = null, subscription = null) {
    await this.trackPushEvent('permission_granted', user, { subscription })
  }

  // Cuando se deniegan permisos
  async trackPermissionDenied(user = null) {
    await this.trackPushEvent('permission_denied', user)
  }

  // Cuando se crea una suscripción
  async trackSubscriptionCreated(user = null, subscription) {
    await this.trackPushEvent('subscription_created', user, { subscription })
  }

  // Cuando se actualiza una suscripción
  async trackSubscriptionUpdated(user = null, subscription) {
    await this.trackPushEvent('subscription_updated', user, { subscription })
  }

  // Cuando se elimina una suscripción
  async trackSubscriptionDeleted(user = null) {
    await this.trackPushEvent('subscription_deleted', user)
  }

  // Cuando se envía una notificación
  async trackNotificationSent(user = null, notificationData) {
    await this.trackPushEvent('notification_sent', user, {
      notificationType: notificationData.type,
      title: notificationData.title,
      body: notificationData.body,
      tag: notificationData.tag,
      customData: notificationData.data || notificationData
    })
  }

  // Cuando se entrega una notificación
  async trackNotificationDelivered(notificationData) {
    await this.trackPushEvent('notification_delivered', {
      notificationType: notificationData.type,
      title: notificationData.title
    })
  }

  // Cuando se hace clic en una notificación
  async trackNotificationClicked(notificationData, responseTime = null) {
    await this.trackPushEvent('notification_clicked', {
      notificationType: notificationData.type,
      title: notificationData.title,
      responseTime,
      customData: notificationData.data
    })
  }

  // Cuando se descarta una notificación
  async trackNotificationDismissed(notificationData) {
    await this.trackPushEvent('notification_dismissed', {
      notificationType: notificationData.type,
      title: notificationData.title
    })
  }

  // Cuando falla el envío de una notificación
  async trackNotificationFailed(error, notificationData = {}) {
    await this.trackPushEvent('notification_failed', {
      error: error.message || error.toString(),
      notificationType: notificationData.type,
      customData: notificationData
    })
  }

  // Cuando se actualizan las configuraciones
  async trackSettingsUpdated(user = null, settingsData) {
    await this.trackPushEvent('settings_updated', user, {
      customData: settingsData
    })
  }

  // Métodos específicos para emails

  // Email enviado
  async trackEmailSent(emailData) {
    await this.trackEmailEvent('sent', emailData)
  }

  // Email entregado
  async trackEmailDelivered(emailData) {
    await this.trackEmailEvent('delivered', emailData)
  }

  // Email abierto
  async trackEmailOpened(emailData) {
    await this.trackEmailEvent('opened', emailData)
  }

  // Link clickeado en email
  async trackEmailClicked(emailData) {
    await this.trackEmailEvent('clicked', emailData)
  }

  // Email rebotó
  async trackEmailBounced(emailData) {
    await this.trackEmailEvent('bounced', emailData)
  }

  // Marcado como spam
  async trackEmailComplained(emailData) {
    await this.trackEmailEvent('complained', emailData)
  }

  // Usuario se desuscribió
  async trackEmailUnsubscribed(emailData) {
    await this.trackEmailEvent('unsubscribed', emailData)
  }
}

// Crear instancia singleton
const notificationTracker = new NotificationTracker()

export default notificationTracker

// Para debugging en desarrollo
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.notificationTracker = notificationTracker
}