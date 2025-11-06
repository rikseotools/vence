// lib/services/pwaTracker.js - SERVICIO PARA TRACKING DE PWA
'use client'
import { getSupabaseClient } from '../supabase'

// Instancia global de Supabase
let supabaseInstance = null

// Detectar información específica de PWA
const getPWAInfo = () => {
  if (typeof window === 'undefined') return {}
  
  return {
    isStandalone: window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone === true ||
                  document.referrer.includes('android-app://'),
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' :
                 window.matchMedia('(display-mode: fullscreen)').matches ? 'fullscreen' :
                 window.matchMedia('(display-mode: minimal-ui)').matches ? 'minimal-ui' : 'browser',
    orientation: screen.orientation?.type || 'unknown',
    installPromptAvailable: 'beforeinstallprompt' in window,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    supportsServiceWorker: 'serviceWorker' in navigator,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      ratio: window.devicePixelRatio || 1
    }
  }
}

// Detectar información del dispositivo
const getDeviceInfo = () => {
  if (typeof window === 'undefined') return {}
  
  const ua = navigator.userAgent
  
  return {
    platform: navigator.platform,
    userAgent: ua,
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
    } : null,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
      orientation: screen.orientation?.type || 'unknown'
    }
  }
}

class PWATracker {
  constructor() {
    this.deviceInfo = getDeviceInfo()
    this.pwaInfo = getPWAInfo()
    this.sessionId = null
    this.sessionStartTime = null
    this.pageVisitCount = 0
    this.actionCount = 0
    this.setupEventListeners()
  }

  // Método para obtener instancia de Supabase
  getSupabase() {
    return supabaseInstance || getSupabaseClient()
  }

  // Método para configurar instancia desde el contexto de Auth
  setSupabaseInstance(supabase) {
    supabaseInstance = supabase
  }

  // Configurar listeners para eventos PWA
  setupEventListeners() {
    if (typeof window === 'undefined') return

    // Listener para detectar cuándo se puede instalar la PWA
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('📱 PWA install prompt available')
      this.trackPWAEvent('install_prompt_shown', {
        canInstall: true,
        userAgent: navigator.userAgent
      })
    })

    // Listener para detectar instalación exitosa
    window.addEventListener('appinstalled', (e) => {
      console.log('🎉 PWA installed successfully!')
      this.trackPWAEvent('pwa_installed', {
        installMethod: 'browser_prompt',
        timestamp: Date.now()
      })
    })

    // Listener para cambios en display mode
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      if (e.matches) {
        console.log('🚀 PWA launched in standalone mode')
        this.trackPWAEvent('pwa_launched_standalone')
      }
    })

    // Listener para visibilidad de la página (sesiones)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.endSession()
      } else {
        this.startSession()
      }
    })

    // Listener para beforeunload (fin de sesión)
    window.addEventListener('beforeunload', () => {
      this.endSession()
    })

    // Detectar navegación (SPA)
    this.setupNavigationTracking()

    // Detectar usuarios PWA existentes al cargar
    this.detectExistingPWAUser()
  }

  // Detectar si el usuario ya tiene PWA instalada (usuarios existentes)
  async detectExistingPWAUser() {
    if (typeof window === 'undefined') return

    try {
      // Detectar si está en modo standalone (PWA ya instalada)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone === true ||
                          document.referrer.includes('android-app://')

      if (isStandalone) {
        console.log('🔍 Usuario PWA existente detectado!')
        
        // Verificar si ya tenemos registrado este evento de instalación
        const supabase = this.getSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) return

        // Buscar si ya hay un evento de instalación registrado
        const { data: existingInstall } = await supabase
          .from('pwa_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('event_type', 'pwa_installed')
          .limit(1)

        if (!existingInstall || existingInstall.length === 0) {
          console.log('📱 Registrando instalación PWA existente...')
          
          // Registrar como instalación existente (retroactiva)
          await this.trackPWAEvent('pwa_installed', {
            installMethod: 'existing_detected',
            detectedAt: Date.now(),
            retroactive: true,
            detectionReason: 'standalone_mode_detected'
          })

          // También registrar que fue lanzada en modo standalone
          await this.trackPWAEvent('pwa_launched_standalone', {
            detectedAt: Date.now(),
            retroactive: true
          })
        } else {
          console.log('✅ Instalación PWA ya registrada previamente')
        }
      } else {
        // Usuario en modo web, pero podría tener PWA instalada
        await this.checkPWAInstallationStatus()
      }

    } catch (error) {
      // Error silencioso para no afectar la experiencia
      console.log('🔍 PWA detection check (silent):', error.message?.includes('relation') ? 'tables not ready' : error.message)
    }
  }

  // Verificar si PWA está instalada usando técnicas avanzadas
  async checkPWAInstallationStatus() {
    if (typeof window === 'undefined') return

    try {
      // Método 1: Verificar si beforeinstallprompt está disponible
      let pwaInstalled = false
      let detectionMethod = 'unknown'

      // Si NO se dispara beforeinstallprompt, podría estar instalada
      const promptTimeout = new Promise(resolve => {
        const timer = setTimeout(() => {
          resolve(false) // No se disparó el prompt
        }, 2000)

        window.addEventListener('beforeinstallprompt', (e) => {
          clearTimeout(timer)
          resolve(true) // Prompt disponible = no instalada
        }, { once: true })
      })

      const promptAvailable = await promptTimeout

      if (!promptAvailable) {
        // No hay prompt = podría estar instalada
        pwaInstalled = true
        detectionMethod = 'no_install_prompt'
      }

      // Método 2: Verificar getInstalledRelatedApps (Chrome/Edge)
      if ('getInstalledRelatedApps' in navigator) {
        try {
          const relatedApps = await navigator.getInstalledRelatedApps()
          if (relatedApps && relatedApps.length > 0) {
            pwaInstalled = true
            detectionMethod = 'related_apps_api'
            console.log('📱 PWA detectada via getInstalledRelatedApps:', relatedApps)
          }
        } catch (e) {
          // API no disponible o fallo
        }
      }

      // Método 3: Heurística de uso frecuente
      const visitCount = localStorage.getItem('vence_visit_count') || 0
      const hasNotifications = Notification.permission === 'granted'
      const hasServiceWorker = 'serviceWorker' in navigator && navigator.serviceWorker.controller

      if (visitCount > 10 && hasNotifications && hasServiceWorker) {
        // Usuario frecuente con características de PWA
        console.log('🤔 Usuario con patrón de uso PWA detectado')
        
        // No registrar automáticamente, pero loggear para análisis
        await this.trackPWAEvent('potential_pwa_user', {
          visitCount: parseInt(visitCount),
          hasNotifications,
          hasServiceWorker,
          detectionMethod: 'usage_pattern'
        })
      }

      if (pwaInstalled && detectionMethod !== 'unknown') {
        console.log(`📱 PWA posiblemente instalada (método: ${detectionMethod})`)
        
        const supabase = this.getSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Verificar si ya está registrada
          const { data: existingInstall } = await supabase
            .from('pwa_events')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_type', 'pwa_installed')
            .limit(1)

          if (!existingInstall || existingInstall.length === 0) {
            await this.trackPWAEvent('pwa_installed', {
              installMethod: 'detected_heuristic',
              detectionMethod,
              confidence: detectionMethod === 'related_apps_api' ? 'high' : 'medium',
              retroactive: true
            })
          }
        }
      }

    } catch (error) {
      console.log('🔍 PWA installation check (silent):', error.message)
    }
  }

  // Trackear navegación en SPA
  setupNavigationTracking() {
    let currentPath = window.location.pathname
    
    // Observar cambios de URL
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname
        this.pageVisitCount++
        this.actionCount++
      }
    })
    
    observer.observe(document, { subtree: true, childList: true })
    
    // También escuchar eventos de navegación
    window.addEventListener('popstate', () => {
      this.pageVisitCount++
      this.actionCount++
    })
  }

  // Registrar evento de PWA
  async trackPWAEvent(eventType, additionalData = {}) {
    try {
      const supabase = this.getSupabase()
      
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('No hay usuario autenticado para tracking PWA')
        return
      }

      const eventData = {
        user_id: user.id,
        event_type: eventType,
        device_info: {
          ...this.deviceInfo,
          ...this.pwaInfo,
          timestamp: Date.now()
        },
        browser_info: {
          name: this.getBrowserName(),
          version: this.getBrowserVersion(),
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        },
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
        created_at: new Date().toISOString(),
        ...additionalData
      }

      const { error } = await supabase
        .from('pwa_events')
        .insert(eventData)

      if (error) {
        // Si la tabla no existe, solo hacer log silencioso
        const errorMsg = error.message || error.code || JSON.stringify(error)
        if (errorMsg.includes('relation') && errorMsg.includes('does not exist')) {
          console.log('📱 PWA tracking tables not created yet (optional feature)')
        } else if (Object.keys(error).length === 0) {
          console.log('📱 PWA tracking: Empty error object (likely table not ready)')
        } else {
          console.log('📱 PWA tracking error (event):', errorMsg)
        }
      } else {
        console.log(`📱 PWA event tracked: ${eventType}`)
      }
    } catch (error) {
      console.error('Error in trackPWAEvent:', error)
    }
  }

  // Iniciar sesión PWA
  async startSession() {
    if (this.sessionId) return // Ya hay sesión activa
    
    try {
      // Incrementar contador de visitas para heurística
      const visitCount = parseInt(localStorage.getItem('vence_visit_count') || '0') + 1
      localStorage.setItem('vence_visit_count', visitCount.toString())
      console.log(`📊 Visita #${visitCount} registrada`)

      const supabase = this.getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      this.sessionStartTime = new Date()
      this.pageVisitCount = 1
      this.actionCount = 0

      const { data, error } = await supabase
        .from('pwa_sessions')
        .insert({
          user_id: user.id,
          session_start: this.sessionStartTime.toISOString(),
          device_info: {
            ...this.deviceInfo,
            ...this.pwaInfo,
            sessionType: this.pwaInfo.isStandalone ? 'pwa' : 'web'
          },
          is_standalone: this.pwaInfo.isStandalone,
          pages_visited: this.pageVisitCount,
          actions_performed: this.actionCount
        })
        .select()

      if (error) {
        // Si la tabla no existe, solo hacer log silencioso
        const errorMsg = error.message || error.code || JSON.stringify(error)
        if (errorMsg.includes('relation') && errorMsg.includes('does not exist')) {
          console.log('📱 PWA tracking tables not created yet (optional feature)')
        } else if (errorMsg.includes('JWT') || errorMsg.includes('token')) {
          console.log('📱 PWA tracking: Auth not ready yet')
        } else if (Object.keys(error).length === 0) {
          console.log('📱 PWA tracking: Empty error object (likely table not ready)')
        } else {
          console.log('📱 PWA tracking error:', errorMsg)
        }
      } else {
        this.sessionId = data[0]?.id
        console.log(`📱 PWA session started: ${this.pwaInfo.isStandalone ? 'PWA' : 'Web'} mode`)
        
        // Trackear inicio de sesión como evento
        await this.trackPWAEvent('session_started', {
          sessionId: this.sessionId,
          isStandalone: this.pwaInfo.isStandalone,
          displayMode: this.pwaInfo.displayMode
        })
      }
    } catch (error) {
      console.error('Error in startSession:', error)
    }
  }

  // Finalizar sesión PWA
  async endSession() {
    if (!this.sessionId || !this.sessionStartTime) return

    try {
      const supabase = this.getSupabase()
      const sessionEnd = new Date()
      const durationMinutes = Math.round((sessionEnd - this.sessionStartTime) / 60000)

      const { error } = await supabase
        .from('pwa_sessions')
        .update({
          session_end: sessionEnd.toISOString(),
          session_duration_minutes: durationMinutes,
          pages_visited: this.pageVisitCount,
          actions_performed: this.actionCount
        })
        .eq('id', this.sessionId)

      if (error) {
        // Si la tabla no existe, solo hacer log silencioso
        const errorMsg = error.message || error.code || JSON.stringify(error)
        if (errorMsg.includes('relation') && errorMsg.includes('does not exist')) {
          console.log('📱 PWA tracking tables not created yet (optional feature)')
        } else if (Object.keys(error).length === 0) {
          console.log('📱 PWA tracking: Empty error object (likely table not ready)')
        } else {
          console.log('📱 PWA tracking error (end session):', errorMsg)
        }
      } else {
        console.log(`📱 PWA session ended: ${durationMinutes} minutes, ${this.pageVisitCount} pages, ${this.actionCount} actions`)
      }

      // Reset session
      this.sessionId = null
      this.sessionStartTime = null
      this.pageVisitCount = 0
      this.actionCount = 0
      
    } catch (error) {
      console.error('Error in endSession:', error)
    }
  }

  // Incrementar contador de acciones
  trackAction(actionType = 'user_interaction') {
    this.actionCount++
    
    // Trackear acciones importantes como eventos
    if (['test_started', 'question_answered', 'test_completed'].includes(actionType)) {
      this.trackPWAEvent('user_action', {
        actionType,
        sessionId: this.sessionId,
        isStandalone: this.pwaInfo.isStandalone
      })
    }
  }

  // Detectar navegador
  getBrowserName() {
    const ua = navigator.userAgent
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
    if (ua.includes('Edg')) return 'Edge'
    return 'Unknown'
  }

  // Detectar versión del navegador
  getBrowserVersion() {
    const ua = navigator.userAgent
    const match = ua.match(/(Chrome|Firefox|Safari|Edge)\/([0-9.]+)/)
    return match ? match[2] : 'Unknown'
  }

  // Obtener información actual de PWA
  getCurrentPWAInfo() {
    return {
      isStandalone: this.pwaInfo.isStandalone,
      displayMode: this.pwaInfo.displayMode,
      sessionActive: !!this.sessionId,
      sessionDuration: this.sessionStartTime ? Math.round((Date.now() - this.sessionStartTime) / 60000) : 0,
      pageVisits: this.pageVisitCount,
      actions: this.actionCount
    }
  }

  // Métodos específicos para eventos comunes
  async trackInstallPromptShown() {
    await this.trackPWAEvent('install_prompt_shown')
  }

  async trackPWAInstalled() {
    await this.trackPWAEvent('pwa_installed')
  }

  async trackPWALaunched() {
    await this.trackPWAEvent('pwa_launched_standalone')
  }

  async trackTestStarted() {
    this.trackAction('test_started')
  }

  async trackQuestionAnswered() {
    this.trackAction('question_answered')
  }

  async trackTestCompleted() {
    this.trackAction('test_completed')
  }
}

// Crear instancia singleton
const pwaTracker = new PWATracker()

export default pwaTracker

// Para debugging en desarrollo
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.pwaTracker = pwaTracker
}