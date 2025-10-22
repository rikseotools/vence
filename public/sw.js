// Service Worker para notificaciones push - vence
// Oposiciones Auxiliar Administrativo del Estado

const CACHE_NAME = 'vence-v1'
const urlsToCache = [
  '/',
  '/icon-192.png',
  '/badge-72.png'
]

// Instalación del service worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalado')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('💾 Agregando URLs al cache:', urlsToCache)
        return cache.addAll(urlsToCache)
      })
      .then(() => {
        console.log('✅ Cache inicializado exitosamente')
      })
      .catch((error) => {
        console.error('❌ Error inicializando cache:', error)
        // No fallar el service worker por errores de cache
      })
  )
  self.skipWaiting()
})

// Activación del service worker
self.addEventListener('activate', (event) => {
  console.log('⚡ Service Worker activado')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Manejo de notificaciones push
self.addEventListener('push', (event) => {
  console.log('📢 Push notification recibida')
  
  let notificationData = {
    title: '🎯 Vence - Tu oposición te espera',
    body: '¡Hora de practicar! Tu plaza de funcionario no se va a conseguir sola.',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'oposicion-reminder',
    data: {
      url: '/es',
      timestamp: Date.now(),
      category: 'motivation',
      trackingId: `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    actions: [
      {
        action: 'study',
        title: '📚 Estudiar',
        icon: '/icon-study.png'
      },
      {
        action: 'later',
        title: '⏰ Después',
        icon: '/icon-later.png'
      }
    ],
    requireInteraction: false,
    silent: false
  }

  // Si viene data del servidor, usarla
  if (event.data) {
    try {
      const serverData = event.data.json()
      notificationData = {
        ...notificationData,
        ...serverData,
        data: {
          ...notificationData.data,
          ...serverData.data
        }
      }
    } catch (error) {
      console.error('Error parsing push data:', error)
    }
  }

  // Personalizar según el contexto
  notificationData = personalizeNotification(notificationData)

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .then(() => {
        // Track notification delivered
        console.log('✅ Notification shown successfully')
        trackNotificationEvent('notification_delivered', notificationData)
      })
      .catch((error) => {
        // Track notification show error
        console.error('❌ Error showing notification:', error)
        trackNotificationEvent('notification_failed', {
          title: 'Show Notification Error',
          data: {
            category: 'show_notification_error',
            errorMessage: error.message || 'Failed to show notification',
            errorName: error.name,
            errorStack: error.stack,
            originalTitle: notificationData.title,
            originalBody: notificationData.body,
            userAgent: navigator.userAgent
          }
        })
      })
  )
})

// Personalizar notificación según contexto
function personalizeNotification(data) {
  const hour = new Date().getHours()
  
  // Personalizar según la hora
  if (hour < 12) {
    data.icon = '/icon-morning.png'
    if (!data.title.includes('🌅')) {
      data.title = '🌅 ' + data.title
    }
  } else if (hour < 18) {
    data.icon = '/icon-afternoon.png'
    if (!data.title.includes('☀️')) {
      data.title = '☀️ ' + data.title
    }
  } else {
    data.icon = '/icon-evening.png'
    if (!data.title.includes('🌆')) {
      data.title = '🌆 ' + data.title
    }
  }

  // Personalizar acciones según categoría
  if (data.data?.category === 'streak_danger') {
    data.actions = [
      {
        action: 'study_urgent',
        title: '🚨 ¡Salvar Racha!',
        icon: '/icon-urgent.png'
      },
      {
        action: 'dismiss',
        title: '⏰ Después',
        icon: '/icon-dismiss.png'
      }
    ]
    data.requireInteraction = true
    data.tag = 'streak-danger'
  } else if (data.data?.category === 'achievement') {
    data.actions = [
      {
        action: 'continue',
        title: '🔥 ¡Continuar!',
        icon: '/icon-continue.png'
      },
      {
        action: 'share',
        title: '📱 Compartir',
        icon: '/icon-share.png'
      }
    ]
    data.tag = 'achievement'
  }

  return data
}

// Manejo de clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Click en notificación:', event.action)
  
  const clickTimestamp = Date.now()
  const notificationTimestamp = event.notification.data?.timestamp || clickTimestamp
  const responseTime = clickTimestamp - notificationTimestamp
  
  event.notification.close()

  const notificationData = event.notification.data || {}
  let targetUrl = notificationData.url || '/es'

  // Track click event with response time
  trackNotificationEvent('notification_clicked', {
    ...event.notification,
    data: {
      ...notificationData,
      action: event.action,
      responseTime: responseTime
    }
  })

  // Determinar URL según la acción
  switch (event.action) {
    case 'study':
    case 'study_urgent':
      targetUrl = '/test/rapido'
      trackNotificationAction('study_clicked', notificationData)
      break
    case 'later':
      // No abrir, solo cerrar
      trackNotificationAction('postponed', notificationData)
      return
    case 'continue':
      targetUrl = '/test/aleatorio'
      trackNotificationAction('continue_clicked', notificationData)
      break
    case 'share':
      // Abrir compartir (implementar más tarde)
      trackNotificationAction('share_clicked', notificationData)
      return
    case 'dismiss':
      trackNotificationAction('dismissed', notificationData)
      return
    default:
      // Click en el cuerpo de la notificación
      trackNotificationAction('notification_clicked', notificationData)
  }

  // Abrir o enfocar ventana
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Buscar ventana existente con la URL
        for (const client of clientList) {
          if (client.url.includes(targetUrl.split('?')[0]) && 'focus' in client) {
            return client.focus()
          }
        }
        
        // Abrir nueva ventana si no existe
        if (clients.openWindow) {
          return clients.openWindow(targetUrl + '?from=notification')
        }
      })
  )
})

// Tracking de acciones de notificaciones
function trackNotificationAction(action, data) {
  console.log(`📊 Tracking: ${action}`, data)
  
  // Enviar evento a la aplicación principal
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NOTIFICATION_ACTION',
        action: action,
        data: data,
        timestamp: Date.now()
      })
    })
  })
}

// Manejo de cierre de notificaciones
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notificación cerrada')
  
  // Track notification dismissed
  trackNotificationEvent('notification_dismissed', event.notification)
  trackNotificationAction('closed', event.notification.data)
})

// Manejo de eventos de background sync (para futuras funcionalidades)
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag)
  
  if (event.tag === 'notification-analytics') {
    event.waitUntil(syncNotificationAnalytics())
  }
})

// Sync de analytics (placeholder para implementación futura)
async function syncNotificationAnalytics() {
  try {
    // Aquí se podría sincronizar analytics offline
    console.log('📊 Sincronizando analytics de notificaciones...')
  } catch (error) {
    console.error('Error syncing notification analytics:', error)
  }
}

// Manejo de fetch para cache (opcional)
self.addEventListener('fetch', (event) => {
  // Solo para recursos específicos, no interferir con la app principal
  if (event.request.url.includes('/icon-') || event.request.url.includes('/badge-')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request)
        })
    )
  }
})

// Manejo de errores mejorado para móviles
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker error:', event.error)
  
  // Trackear errores del service worker
  trackNotificationEvent('notification_failed', {
    title: 'Service Worker Error',
    data: {
      category: 'service_worker_error',
      errorMessage: event.error?.message || 'Unknown SW error',
      errorStack: event.error?.stack,
      errorFilename: event.filename,
      errorLineno: event.lineno,
      userAgent: navigator.userAgent
    }
  })
})

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker unhandled rejection:', event.reason)
  
  // Solo trackear si es realmente un error de notificaciones, no de cache
  const isNotificationError = event.reason?.message?.includes('notification') || 
                              event.reason?.message?.includes('push') ||
                              event.reason?.message?.includes('subscription')
  
  if (isNotificationError) {
    // Trackear promise rejections del service worker
    trackNotificationEvent('notification_failed', {
      title: 'Service Worker Promise Rejection',
      data: {
        category: 'service_worker_promise_rejection',
        errorMessage: event.reason?.message || event.reason?.toString() || 'Unknown promise rejection',
        errorStack: event.reason?.stack,
        userAgent: navigator.userAgent
      }
    })
  } else {
    console.log('⚠️ Error de SW no relacionado con notificaciones, no tracking')
  }
})

// Función para tracking de eventos de notificaciones
async function trackNotificationEvent(eventType, notificationData) {
  try {
    // Obtener información del dispositivo/navegador desde el service worker
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform || 'unknown',
      timestamp: Date.now()
    }

    const browserInfo = {
      name: getBrowserName(),
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    }

    const eventData = {
      event_type: eventType,
      notification_type: notificationData.data?.category || 'unknown',
      device_info: deviceInfo,
      browser_info: browserInfo,
      notification_data: {
        title: notificationData.title,
        body: notificationData.body,
        tag: notificationData.tag,
        icon: notificationData.icon,
        badge: notificationData.badge,
        actions: notificationData.actions,
        trackingId: notificationData.data?.trackingId,
        action: notificationData.data?.action,
        responseTime: notificationData.data?.responseTime
      },
      response_time_ms: notificationData.data?.responseTime || null,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString()
    }

    // Enviar a la app principal para que maneje el tracking con usuario autenticado
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'TRACK_NOTIFICATION_EVENT',
        eventType: eventType,
        data: eventData
      })
    })

    console.log(`📊 SW: Notification event tracked: ${eventType}`)
  } catch (error) {
    console.error('Error tracking notification event in SW:', error)
  }
}

// Detectar navegador básico
function getBrowserName() {
  const ua = navigator.userAgent
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
  if (ua.includes('Edg')) return 'Edge'
  return 'Unknown'
}