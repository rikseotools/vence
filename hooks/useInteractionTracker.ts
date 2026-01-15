// hooks/useInteractionTracker.ts - Hook para tracking de interacciones de usuario
import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// ============================================
// TIPOS
// ============================================

type EventCategory = 'test' | 'chat' | 'navigation' | 'ui' | 'auth' | 'error' | 'conversion' | 'psychometric'

interface InteractionEvent {
  eventType: string
  eventCategory: EventCategory
  component?: string
  action?: string
  label?: string
  value?: Record<string, unknown>
  pageUrl?: string
  elementId?: string
  elementText?: string
  responseTimeMs?: number
}

interface QueuedEvent extends InteractionEvent {
  userId?: string | null
  sessionId?: string
  deviceInfo?: DeviceInfo
  timestamp?: number
}

interface DeviceInfo {
  platform?: string
  userAgent?: string
  screenWidth?: number
  screenHeight?: number
  language?: string
  timezone?: string
  isStandalone?: boolean
  isMobile?: boolean
}

// ============================================
// CONSTANTES
// ============================================

const BATCH_SIZE = 10
const FLUSH_INTERVAL = 5000 // 5 segundos
const SESSION_KEY = 'vence_tracking_session'
const QUEUE_KEY = 'vence_tracking_queue'

// ============================================
// HELPERS
// ============================================

function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') return {}

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true

  return {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isStandalone,
    isMobile: /Mobi|Android/i.test(navigator.userAgent)
  }
}

function loadQueueFromStorage(): QueuedEvent[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(QUEUE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveQueueToStorage(queue: QueuedEvent[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Storage full or unavailable
  }
}

function clearQueueFromStorage(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(QUEUE_KEY)
  } catch {
    // Ignore
  }
}

// ============================================
// SINGLETON QUEUE (para evitar duplicados entre renders)
// ============================================

let globalQueue: QueuedEvent[] = []
let flushTimeout: NodeJS.Timeout | null = null
let isFlushing = false

async function flushQueue(forceAll = false): Promise<void> {
  if (isFlushing || globalQueue.length === 0) return

  isFlushing = true

  try {
    const eventsToSend = forceAll ? globalQueue : globalQueue.slice(0, BATCH_SIZE)

    const response = await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: eventsToSend }),
      // No bloquear navegación
      keepalive: true
    })

    if (response.ok) {
      // Remover eventos enviados
      globalQueue = globalQueue.slice(eventsToSend.length)
      clearQueueFromStorage()

      if (globalQueue.length > 0) {
        saveQueueToStorage(globalQueue)
      }
    }

  } catch (error) {
    console.warn('⚠️ [Tracker] Error enviando eventos:', error)
    // Guardar en localStorage para reintentar
    saveQueueToStorage(globalQueue)
  } finally {
    isFlushing = false
  }
}

function scheduleFlush(): void {
  if (flushTimeout) return

  flushTimeout = setTimeout(() => {
    flushTimeout = null
    flushQueue()
  }, FLUSH_INTERVAL)
}

function addToQueue(event: QueuedEvent): void {
  globalQueue.push(event)

  // Flush si alcanzamos el batch size
  if (globalQueue.length >= BATCH_SIZE) {
    flushQueue()
  } else {
    scheduleFlush()
  }
}

// ============================================
// HOOK
// ============================================

export function useInteractionTracker() {
  const { user } = useAuth() as { user: { id: string } | null }
  const deviceInfoRef = useRef<DeviceInfo | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Inicializar en cliente
  useEffect(() => {
    if (typeof window === 'undefined') return

    deviceInfoRef.current = getDeviceInfo()
    sessionIdRef.current = getSessionId()

    // Cargar eventos pendientes de localStorage
    const pendingEvents = loadQueueFromStorage()
    if (pendingEvents.length > 0) {
      globalQueue = [...pendingEvents, ...globalQueue]
      flushQueue()
    }

    // Flush al cerrar pestaña
    const handleBeforeUnload = () => {
      if (globalQueue.length > 0) {
        // Usar sendBeacon para envío garantizado
        const data = JSON.stringify({ events: globalQueue })
        navigator.sendBeacon('/api/interactions', data)
        globalQueue = []
        clearQueueFromStorage()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (flushTimeout) {
        clearTimeout(flushTimeout)
        flushTimeout = null
      }
    }
  }, [])

  // ============================================
  // FUNCIÓN BASE DE TRACKING
  // ============================================

  const track = useCallback((event: InteractionEvent) => {
    const queuedEvent: QueuedEvent = {
      ...event,
      userId: user?.id || null,
      sessionId: sessionIdRef.current || undefined,
      deviceInfo: deviceInfoRef.current || undefined,
      pageUrl: event.pageUrl || (typeof window !== 'undefined' ? window.location.pathname : undefined),
      timestamp: Date.now()
    }

    addToQueue(queuedEvent)
  }, [user?.id])

  // ============================================
  // FUNCIONES ESPECÍFICAS POR CATEGORÍA
  // ============================================

  const trackClick = useCallback((
    component: string,
    action: string,
    data?: Record<string, unknown>
  ) => {
    track({
      eventType: `${component}_${action}`,
      eventCategory: 'ui',
      component,
      action,
      value: data
    })
  }, [track])

  const trackNavigation = useCallback((
    from: string,
    to: string,
    method?: string
  ) => {
    track({
      eventType: 'page_navigation',
      eventCategory: 'navigation',
      action: method || 'click',
      value: { from, to }
    })
  }, [track])

  const trackTestAction = useCallback((
    action: string,
    questionId?: string,
    data?: Record<string, unknown>
  ) => {
    track({
      eventType: `test_${action}`,
      eventCategory: 'test',
      component: 'TestLayout',
      action,
      value: { questionId, ...data }
    })
  }, [track])

  const trackPsychometricAction = useCallback((
    action: string,
    questionId?: string,
    data?: Record<string, unknown>
  ) => {
    track({
      eventType: `psycho_${action}`,
      eventCategory: 'psychometric',
      component: 'PsychometricTestLayout',
      action,
      value: { questionId, ...data }
    })
  }, [track])

  const trackChatAction = useCallback((
    action: string,
    data?: Record<string, unknown>
  ) => {
    track({
      eventType: `chat_${action}`,
      eventCategory: 'chat',
      component: 'AIChatWidget',
      action,
      value: data
    })
  }, [track])

  const trackAuthAction = useCallback((
    action: string,
    data?: Record<string, unknown>
  ) => {
    track({
      eventType: `auth_${action}`,
      eventCategory: 'auth',
      component: 'Auth',
      action,
      value: data
    })
  }, [track])

  const trackError = useCallback((
    component: string,
    error: string | Error,
    data?: Record<string, unknown>
  ) => {
    track({
      eventType: 'error_occurred',
      eventCategory: 'error',
      component,
      label: typeof error === 'string' ? error : error.message,
      value: {
        stack: error instanceof Error ? error.stack : undefined,
        ...data
      }
    })
  }, [track])

  const trackConversion = useCallback((
    action: string,
    data?: Record<string, unknown>
  ) => {
    track({
      eventType: `conversion_${action}`,
      eventCategory: 'conversion',
      action,
      value: data
    })
  }, [track])

  // ============================================
  // FLUSH MANUAL (útil para debugging)
  // ============================================

  const flush = useCallback(() => {
    return flushQueue(true)
  }, [])

  return {
    track,
    trackClick,
    trackNavigation,
    trackTestAction,
    trackPsychometricAction,
    trackChatAction,
    trackAuthAction,
    trackError,
    trackConversion,
    flush
  }
}

// ============================================
// EXPORT SINGLETON PARA USO SIN HOOK
// ============================================

export const InteractionTracker = {
  track: (event: InteractionEvent & { userId?: string }) => {
    const queuedEvent: QueuedEvent = {
      ...event,
      sessionId: typeof window !== 'undefined' ? getSessionId() : undefined,
      deviceInfo: typeof window !== 'undefined' ? getDeviceInfo() : undefined,
      pageUrl: event.pageUrl || (typeof window !== 'undefined' ? window.location.pathname : undefined),
      timestamp: Date.now()
    }

    addToQueue(queuedEvent)
  },

  flush: () => flushQueue(true)
}
