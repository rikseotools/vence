// hooks/useIntelligentNotifications.js - SISTEMA COMPLETO DE NOTIFICACIONES INTELIGENTES CON PERSISTENCIA Y EMAIL FALLBACK
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  mapLawSlugToShortName,
  generateLawSlug,
  getLawInfo 
} from '../lib/lawMappingUtils'
import { MotivationalAnalyzer } from '../lib/notifications/motivationalAnalyzer.js'

// 🆕 FUNCIÓN PARA ENVIAR EMAIL FALLBACK DE MENSAJES MOTIVACIONALES
async function sendMotivationalEmail(user, notification) {
  try {
    console.log('📧 Enviando email motivacional fallback:', notification.type)
    
    const response = await fetch('/api/send-motivational-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail: user.email,
        userName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
        messageType: notification.type,
        title: notification.title,
        body: notification.body,
        primaryAction: notification.primaryAction,
        secondaryAction: notification.secondaryAction,
        userId: user.id
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error enviando email motivacional')
    }

    const result = await response.json()
    console.log('✅ Email motivacional enviado correctamente:', result.emailId)
    return true
  } catch (error) {
    console.error('❌ Error en sendMotivationalEmail:', error)
    return false
  }
}

// 🆕 FUNCIÓN PARA INTENTAR PUSH Y FALLBACK A EMAIL
async function sendNotificationWithFallback(user, notification) {
  // Primero intentar notificación push
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: `motivational-${notification.type}`,
        requireInteraction: false,
        silent: false
      })
      console.log('✅ Notificación push enviada correctamente')
      return true
    }
  } catch (pushError) {
    console.warn('⚠️ Push notification falló:', pushError)
  }

  // Si push falló o no está disponible, enviar email
  console.log('📧 Push no disponible, enviando email fallback...')
  return await sendMotivationalEmail(user, notification)
}

// 🔧 FUNCIONES PARA PERSISTENCIA LOCAL (localStorage) - NUEVO
const DISMISSED_NOTIFICATIONS_KEY = 'dismissed_notifications'
const DISMISSED_EXPIRY_HOURS = 24 // Las notificaciones descartadas se "olvidan" después de 24h

// 🆕 SISTEMA DE COOLDOWN PARA ARTÍCULOS PROBLEMÁTICOS
const PROBLEMATIC_ARTICLES_COOLDOWN_KEY = 'problematic_articles_cooldown'
const COOLDOWN_DAYS = 3 // No mostrar misma notificación durante 3 días
const MIN_TESTS_THRESHOLD = 5 // Mínimo 5 tests completados para re-mostrar
const URGENT_ACCURACY_THRESHOLD = 30 // Si accuracy < 30%, mostrar tras solo 3 tests

// 🆕 SISTEMA DE COOLDOWN GLOBAL PARA LOGROS Y PROGRESO
const ACHIEVEMENT_COOLDOWN_KEY = 'achievement_global_cooldown'
const DAILY_ACHIEVEMENT_LIMIT = 2 // Máximo 2 notificaciones de logros/progreso por día
const ACHIEVEMENT_COOLDOWN_HOURS = 24 // Cooldown de 24 horas

// Obtener notificaciones descartadas del localStorage
const getDismissedNotifications = () => {
  try {
    if (typeof window === 'undefined') return new Set() // SSR protection
    
    const stored = localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY)
    if (!stored) return new Set()
    
    const { notifications, timestamp } = JSON.parse(stored)
    
    // Verificar si han pasado más de 24 horas
    const hoursElapsed = (Date.now() - timestamp) / (1000 * 60 * 60)
    if (hoursElapsed > DISMISSED_EXPIRY_HOURS) {
      localStorage.removeItem(DISMISSED_NOTIFICATIONS_KEY)
      return new Set()
    }
    
    return new Set(notifications)
  } catch (error) {
    console.error('Error leyendo notificaciones descartadas:', error)
    return new Set()
  }
}

// Guardar notificación descartada en localStorage
const saveDismissedNotification = (notificationId) => {
  try {
    if (typeof window === 'undefined') return // SSR protection
    
    const dismissed = getDismissedNotifications()
    dismissed.add(notificationId)
    
    const data = {
      notifications: Array.from(dismissed),
      timestamp: Date.now()
    }
    
    localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(data))
    console.log(`💾 Notificación ${notificationId} marcada como descartada persistentemente`)
  } catch (error) {
    console.error('Error guardando notificación descartada:', error)
  }
}

// 🆕 FUNCIONES PARA COOLDOWN DE ARTÍCULOS PROBLEMÁTICOS
const getProblematicArticlesCooldown = (userId) => {
  try {
    if (typeof window === 'undefined') return {} // SSR protection
    
    const stored = localStorage.getItem(`${PROBLEMATIC_ARTICLES_COOLDOWN_KEY}_${userId}`)
    if (!stored) return {}
    
    const cooldownData = JSON.parse(stored)
    
    // Limpiar datos expirados (más de COOLDOWN_DAYS)
    const now = Date.now()
    const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    
    Object.keys(cooldownData).forEach(articleKey => {
      const data = cooldownData[articleKey]
      if (data.lastShown && (now - data.lastShown) > cooldownMs) {
        delete cooldownData[articleKey]
      }
    })
    
    return cooldownData
  } catch (error) {
    console.error('Error leyendo cooldown de artículos problemáticos:', error)
    return {}
  }
}

const saveProblematicArticleCooldown = (userId, lawShortName, articleNumber, testsCompleted) => {
  try {
    if (typeof window === 'undefined') return // SSR protection
    
    const cooldownData = getProblematicArticlesCooldown(userId)
    const articleKey = `${lawShortName}-${articleNumber}`
    
    cooldownData[articleKey] = {
      lastShown: Date.now(),
      testsAtLastShown: testsCompleted,
      lawShortName,
      articleNumber
    }
    
    localStorage.setItem(`${PROBLEMATIC_ARTICLES_COOLDOWN_KEY}_${userId}`, JSON.stringify(cooldownData))
    console.log(`🕒 Cooldown guardado para ${articleKey}: ${testsCompleted} tests completados`)
  } catch (error) {
    console.error('Error guardando cooldown de artículo problemático:', error)
  }
}

const shouldShowProblematicArticle = (userId, lawShortName, articleNumber, accuracy, currentTestsCompleted) => {
  const cooldownData = getProblematicArticlesCooldown(userId)
  const articleKey = `${lawShortName}-${articleNumber}`
  const articleCooldown = cooldownData[articleKey]
  
  // Si no hay datos de cooldown, mostrar la notificación
  if (!articleCooldown) {
    console.log(`✅ Mostrar ${articleKey}: Primera vez`)
    return true
  }
  
  const now = Date.now()
  const timeSinceLastShown = now - articleCooldown.lastShown
  const daysSinceLastShown = timeSinceLastShown / (24 * 60 * 60 * 1000)
  const testsSinceLastShown = currentTestsCompleted - articleCooldown.testsAtLastShown
  
  // CASO URGENTE: Accuracy muy baja (<30%), mostrar tras 3 tests mínimo
  if (accuracy < URGENT_ACCURACY_THRESHOLD && testsSinceLastShown >= 3) {
    console.log(`🚨 Mostrar ${articleKey}: URGENTE - accuracy ${accuracy}% < ${URGENT_ACCURACY_THRESHOLD}% tras ${testsSinceLastShown} tests`)
    return true
  }
  
  // CASO NORMAL: 3 días Y 5 tests mínimo
  if (daysSinceLastShown >= COOLDOWN_DAYS && testsSinceLastShown >= MIN_TESTS_THRESHOLD) {
    console.log(`✅ Mostrar ${articleKey}: Cooldown cumplido - ${Math.round(daysSinceLastShown)} días y ${testsSinceLastShown} tests`)
    return true
  }
  
  // No mostrar
  const remainingDays = Math.max(0, COOLDOWN_DAYS - daysSinceLastShown)
  const remainingTests = Math.max(0, MIN_TESTS_THRESHOLD - testsSinceLastShown)
  console.log(`🚫 NO mostrar ${articleKey}: Faltan ${Math.ceil(remainingDays)} días o ${remainingTests} tests`)
  return false
}

// 🆕 FUNCIONES PARA COOLDOWN GLOBAL DE LOGROS
const getAchievementCooldown = (userId) => {
  try {
    if (typeof window === 'undefined') return { count: 0, lastReset: Date.now() }
    
    const stored = localStorage.getItem(`${ACHIEVEMENT_COOLDOWN_KEY}_${userId}`)
    if (!stored) return { count: 0, lastReset: Date.now() }
    
    const cooldownData = JSON.parse(stored)
    const now = Date.now()
    const timeSinceReset = now - cooldownData.lastReset
    const hoursSinceReset = timeSinceReset / (60 * 60 * 1000)
    
    // Si han pasado 24 horas, resetear el contador
    if (hoursSinceReset >= ACHIEVEMENT_COOLDOWN_HOURS) {
      return { count: 0, lastReset: now }
    }
    
    return cooldownData
  } catch (error) {
    console.error('Error leyendo cooldown de logros:', error)
    return { count: 0, lastReset: Date.now() }
  }
}

const canShowAchievement = (userId) => {
  const cooldownData = getAchievementCooldown(userId)
  const canShow = cooldownData.count < DAILY_ACHIEVEMENT_LIMIT
  
  if (!canShow) {
    console.log(`🚫 Cooldown global de logros: ${cooldownData.count}/${DAILY_ACHIEVEMENT_LIMIT} por hoy`)
  }
  
  return canShow
}

const recordAchievementShown = (userId) => {
  try {
    if (typeof window === 'undefined') return
    
    const cooldownData = getAchievementCooldown(userId)
    const newData = {
      count: cooldownData.count + 1,
      lastReset: cooldownData.lastReset
    }
    
    localStorage.setItem(`${ACHIEVEMENT_COOLDOWN_KEY}_${userId}`, JSON.stringify(newData))
    console.log(`📊 Logro registrado: ${newData.count}/${DAILY_ACHIEVEMENT_LIMIT} por hoy`)
  } catch (error) {
    console.error('Error registrando logro mostrado:', error)
  }
}

// 🎯 CONFIGURACIÓN DE TIPOS DE NOTIFICACIONES CON ACCIONES
const NOTIFICATION_TYPES = {
  // 🔴 CRÍTICAS (Prioridad 90-100) - ACCIÓN INMEDIATA
  'level_regression': { 
    priority: 90, 
    icon: '📉', 
    color: 'red',
    bgColor: 'bg-red-100 dark:bg-red-900/50',
    textColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    primaryAction: {
      label: '🎯 Test de Refuerzo (5 min)',
      type: 'directed_test'
    },
    secondaryAction: {
      label: '📖 Ver Teoría',
      type: 'view_theory'
    }
  },
  'streak_broken': { 
    priority: 95, 
    icon: '💔', 
    color: 'red',
    bgColor: 'bg-red-100 dark:bg-red-900/50',
    textColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    primaryAction: {
      label: '🚀 Recuperar Racha (3 min)',
      type: 'quick_test'
    },
    secondaryAction: {
      label: '📊 Ver Mi Progreso',
      type: 'view_stats'
    }
  },

  // 🟠 IMPORTANTES (Prioridad 70-89) - ACCIÓN DE MEJORA
  'problematic_articles': { 
    priority: 85, 
    icon: '📉', 
    color: 'orange',
    bgColor: 'bg-orange-100 dark:bg-orange-900/50',
    textColor: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-200 dark:border-orange-800',
    primaryAction: {
      label: '🔥 Test Intensivo (10 preguntas)',
      type: 'intensive_test'
    },
    secondaryAction: {
      label: '📖 Ver Teoría',
      type: 'view_theory'
    }
  },

  // 🟡 RECOMENDACIONES (Prioridad 50-69) - ACCIÓN DE CONTINUIDAD
  'study_streak': { 
    priority: 65, 
    icon: '🔥', 
    color: 'yellow',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/50',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    primaryAction: {
      label: '🚀 Mantener Racha (5 min)',
      type: 'maintain_streak'
    },
    secondaryAction: {
      label: '📈 Ver Racha Completa',
      type: 'view_streak_stats'
    }
  },
  'achievement': { 
    priority: 60, 
    icon: '🏆', 
    color: 'yellow',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/50',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    primaryAction: {
      label: '🎯 Próximo Desafío',
      type: 'next_challenge'
    },
    secondaryAction: {
      label: '🏆 Ver Logros',
      type: 'view_achievements'
    }
  },
  'improvement': { 
    priority: 55, 
    icon: '📈', 
    color: 'yellow',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/50',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    primaryAction: {
      label: '🚀 Consolidar Mejora',
      type: 'consolidate_improvement'
    },
    secondaryAction: {
      label: '📈 Ver Progreso',
      type: 'view_progress'
    }
  },

  // 🔵 INFORMATIVAS (Prioridad 30-49) - ACCIÓN EXPLORATORIA
  'dispute_update': { 
    priority: 40, 
    icon: '✅', 
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    primaryAction: {
      label: '🔍 Ver Pregunta Corregida',
      type: 'view_corrected_question'
    },
    secondaryAction: {
      label: '📋 Mis Impugnaciones',
      type: 'view_disputes'
    }
  },
  'feedback_response': { 
    priority: 35, 
    icon: '💬', 
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    primaryAction: {
      label: '💬 Abrir Chat',
      type: 'open_chat'
    },
    secondaryAction: {
      label: '📋 Ver Feedback',
      type: 'view_feedback'
    }
  },
  'progress_update': { 
    priority: 35, 
    icon: '📊', 
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    primaryAction: {
      label: '🎯 Test Avanzado',
      type: 'advanced_test'
    },
    secondaryAction: {
      label: '📊 Ver Detalles',
      type: 'view_details'
    }
  },
  'new_content': {
    priority: 35,
    icon: '🆕',
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    primaryAction: {
      label: '🔍 Explorar Contenido',
      type: 'explore_content'
    },
    secondaryAction: {
      label: '📋 Ver Novedades',
      type: 'view_changelog'
    }
  }
}

// ✅ FUNCIÓN AUXILIAR: Validar y mapear law_short_name usando sistema centralizado
function validateAndMapLawShortName(lawShortName, lawFullName) {
  // Si ya tenemos un short_name válido, usarlo
  if (lawShortName && lawShortName !== 'undefined' && lawShortName !== 'null' && lawShortName.trim() !== '') {
    return lawShortName
  }
  
  console.warn(`⚠️ law_short_name inválido: "${lawShortName}", intentando mapear desde: "${lawFullName}"`)
  
  // 🎯 USAR SISTEMA CENTRALIZADO: Buscar por patrones en el nombre completo
  if (lawFullName) {
    try {
      // Intentar generar slug desde nombre completo y luego mapear
      const possibleSlugs = [
        // Generar diferentes variaciones de slug
        lawFullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '-'),
        lawFullName.replace(/ley\s*/i, 'ley-').toLowerCase(),
        lawFullName.replace(/\s*\/\s*/g, '-').toLowerCase(),
        // Casos específicos comunes
        lawFullName.includes('39/2015') ? 'lpac' : null,
        lawFullName.includes('40/2015') ? 'lrjsp' : null,
        lawFullName.includes('19/2013') ? 'ley-19-2013' : null,
        lawFullName.toLowerCase().includes('constitución') ? 'ce' : null,
        lawFullName.includes('50/1997') ? 'ley-50-1997' : null,
        lawFullName.includes('7/1985') ? 'ley-7-1985' : null
      ].filter(Boolean)
      
      for (const slug of possibleSlugs) {
        const mappedShortName = mapLawSlugToShortName(slug)
        // Si el mapeo devuelve algo diferente al slug original, es válido
        if (mappedShortName && mappedShortName !== slug) {
          console.log(`✅ Mapeo centralizado: "${lawFullName}" → "${slug}" → "${mappedShortName}"`)
          return mappedShortName
        }
      }
      
      // Búsqueda por fragmentos adicionales
      const fragmentMappings = {
        'procedimiento administrativo': 'LPAC',
        'régimen jurídico': 'LRJSP', 
        'transparencia': 'Ley 19/2013',
        'gobierno': 'Ley 50/1997',
        'bases del régimen local': 'Ley 7/1985',
        'tratado de la unión europea': 'TUE',
        'tratado de funcionamiento': 'TFUE'
      }
      
      const fullNameLower = lawFullName.toLowerCase()
      for (const [fragment, shortName] of Object.entries(fragmentMappings)) {
        if (fullNameLower.includes(fragment)) {
          console.log(`🔍 Mapeo por fragmento: "${lawFullName}" → "${shortName}"`)
          return shortName
        }
      }
    } catch (error) {
      console.error('Error en mapeo centralizado:', error)
    }
  }
  
  console.warn(`❌ No se pudo mapear: short="${lawShortName}", full="${lawFullName}", usando fallback`)
  return 'LPAC' // Fallback a la ley más común
}

export function useIntelligentNotifications() {
  const { user, supabase } = useAuth()
  
  // Estados principales
  const [allNotifications, setAllNotifications] = useState([])
  const [loading, setLoading] = useState(false) // Cambiar a false para permitir carga inicial
  const [lastUpdate, setLastUpdate] = useState(null)
  const [lastMotivationalCheck, setLastMotivationalCheck] = useState(null)
  
  // Estados por categoría
  const [disputeNotifications, setDisputeNotifications] = useState([])
  const [problematicArticles, setProblematicArticles] = useState([])
  const [studyStreaks, setStudyStreaks] = useState([])
  const [achievements, setAchievements] = useState([])
  const [studyReminders, setStudyReminders] = useState([])
  const [progressUpdates, setProgressUpdates] = useState([])
  const [motivationalNotifications, setMotivationalNotifications] = useState([])
  const [systemNotifications, setSystemNotifications] = useState([])

  // 🆕 FUNCIÓN PARA GENERAR URLs DE ACCIÓN ESPECÍFICAS - CON SISTEMA CENTRALIZADO
  const generateActionUrl = (notification, actionType = 'primary') => {
    const baseParams = new URLSearchParams({
      utm_source: 'notification',
      utm_campaign: notification.campaign || 'general',
      notification_id: notification.id
    })
    
    try {
      switch (notification.type) {
        case 'problematic_articles':
          if (actionType === 'intensive_test') {
            // 🎯 USAR generateLawSlug DEL SISTEMA CENTRALIZADO
            const lawSlug = generateLawSlug(notification.law_short_name)
            const articles = notification.articlesList?.map(a => a.article_number).join(',') || ''
            
            baseParams.append('articles', articles)
            baseParams.append('mode', 'intensive')
            baseParams.append('n', Math.min(notification.articlesCount * 2, 10).toString())
            
            console.log(`🔗 URL generada con sistema centralizado: ${notification.law_short_name} → ${lawSlug}`)
            return `/test/${encodeURIComponent(lawSlug)}/articulos-dirigido?${baseParams.toString()}`
          } else if (actionType === 'view_theory') {
            const lawSlug = generateLawSlug(notification.law_short_name)
            // 🆕 INCLUIR ARTÍCULOS ESPECÍFICOS EN LA URL DE TEORÍA
            const articles = notification.articlesList?.map(a => a.article_number).join(',') || ''
            console.log('🔗 Generando URL view_theory para:', notification.law_short_name)
            console.log('📋 Artículos para URL:', articles)
            if (articles) {
              baseParams.append('articles', articles)
            }
            const finalUrl = `/teoria/${lawSlug}?${baseParams.toString()}`
            console.log('🌐 URL final:', finalUrl)
            return finalUrl
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
            // 🆕 INCLUIR ARTÍCULOS ESPECÍFICOS EN LA URL DE TEORÍA
            const articles = notification.articlesList?.map(a => a.article_number).join(',') || ''
            console.log('🔗 Generando URL view_theory para:', notification.law_short_name)
            console.log('📋 Artículos para URL:', articles)
            if (articles) {
              baseParams.append('articles', articles)
            }
            const finalUrl = `/teoria/${lawSlug}?${baseParams.toString()}`
            console.log('🌐 URL final:', finalUrl)
            return finalUrl
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
          if (actionType === 'view_corrected_question') {
            const questionId = notification.question_id
            return `/pregunta/${questionId}?${baseParams.toString()}`
          } else if (actionType === 'view_disputes') {
            return `/mis-impugnaciones?${baseParams.toString()}`
          }
          break

        case 'feedback_response':
          if (actionType === 'open_chat') {
            return `/feedback/chat?conversation_id=${notification.data?.conversation_id}`
          } else if (actionType === 'view_feedback') {
            return `/feedback?${baseParams.toString()}`
          }
          break
          
        default:
          console.warn('Tipo de notificación no reconocido:', notification.type)
          return `/test/rapido?${baseParams.toString()}`
      }
    } catch (error) {
      console.error('Error generando URL de acción:', error)
      return `/test/rapido?${baseParams.toString()}`
    }
    
    // Fallback por defecto
    return `/test/rapido?${baseParams.toString()}`
  }

  // 🆕 FUNCIÓN PARA EJECUTAR ACCIÓN - ACTUALIZADA CON PERSISTENCIA
  const executeAction = async (notification, actionType = 'primary') => {
    try {
      const notificationType = NOTIFICATION_TYPES[notification.type]
      if (!notificationType) return

      const action = actionType === 'primary' 
        ? notificationType.primaryAction 
        : notificationType.secondaryAction

      if (!action) return

      const actionUrl = generateActionUrl(notification, action.type)
      
      console.log(`🎯 Ejecutando acción: ${action.label} → ${actionUrl}`)
      
      // ✅ NUEVO: Guardar en localStorage ANTES de navegar si es acción primaria
      if (actionType === 'primary') {
        saveDismissedNotification(notification.id)
        dismissNotification(notification.id)
        console.log(`🗑️ Notificación ${notification.id} ocultada PERMANENTEMENTE por acción primaria`)
      } else {
        console.log(`👁️ Acción secundaria: notificación ${notification.id} permanece visible`)
      }
      
      // Breve delay para que el usuario vea que la notificación desaparece
      setTimeout(() => {
        window.location.href = actionUrl
      }, 200) // 200ms - imperceptible pero permite ver el cambio visual
      
    } catch (error) {
      console.error('❌ Error ejecutando acción:', error)
      // Si hay error, navegar de todos modos
      const actionUrl = generateActionUrl(notification, action?.type || 'default')
      window.location.href = actionUrl
    }
  }

  // Cargar todas las notificaciones cuando el usuario cambie
  useEffect(() => {
    
    if (user && supabase && !loading) {
      loadAllNotifications()
    } else if (!user) {
      resetNotifications()
    } else {
    }
  }, [user, supabase])

  // Función auxiliar para filtrar notificaciones leídas (OPCIÓN B: desaparecen)
  const filterUnreadNotifications = (notifications) => {
    try {
      const readNotificationsKey = `read_notifications_${user?.id || 'anonymous'}`
      const readNotifications = JSON.parse(localStorage.getItem(readNotificationsKey) || '{}')
      
      // Filtrar: solo mostrar las que NO están marcadas como leídas
      return notifications.filter(notification => {
        const isReadInStorage = !!readNotifications[notification.id]
        const isReadInDB = notification.isRead // Para impugnaciones
        return !isReadInStorage && !isReadInDB
      })
    } catch (error) {
      console.error('Error filtrando notificaciones leídas:', error)
      return notifications
    }
  }

  // Función principal para cargar todas las notificaciones
  const loadAllNotifications = async () => {
    try {
      setLoading(true)

      // Cargar en paralelo todas las categorías
      await Promise.all([
        loadDisputeNotifications(),
        loadProblematicArticles(),
        loadStudyStreaks(),
        loadAchievements(),
        loadStudyReminders(),
        loadProgressUpdates(),
        loadSystemNotifications()
      ])
      

      // 🆕 Si no hay notificaciones urgentes, cargar motivacionales
      const hasUrgentNotifications = [
        ...disputeNotifications,
        ...problematicArticles,
        ...studyStreaks,
        ...achievements,
        ...studyReminders,
        ...progressUpdates,
        ...systemNotifications
      ].some(n => !n.isRead)

      if (!hasUrgentNotifications) {
        // Solo cargar motivacionales si han pasado al menos 5 minutos desde la última carga
        const now = Date.now()
        const fiveMinutesAgo = 5 * 60 * 1000
        
        if (!lastMotivationalCheck || (now - lastMotivationalCheck) > fiveMinutesAgo) {
          await loadMotivationalNotifications()
          setLastMotivationalCheck(now)
        }
      }

      setLastUpdate(new Date())

    } catch (error) {
      console.error('❌ Error cargando notificaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  // 1️⃣ CARGAR IMPUGNACIONES CON ACCIONES ESPECÍFICAS
  const loadDisputeNotifications = async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: disputes, error } = await supabase
        .from('question_disputes')
        .select(`
          id,
          dispute_type,
          status,
          resolved_at,
          admin_response,
          created_at,
          is_read,
          questions!inner (
            id,
            question_text,
            articles!inner (
              id,
              article_number,
              laws!inner (short_name)
            )
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['resolved', 'rejected'])
        .gte('resolved_at', thirtyDaysAgo)
        .or('is_read.is.null,is_read.eq.false')
        .order('resolved_at', { ascending: false })

      if (error) throw error

      const notifications = disputes?.map(dispute => ({
        id: `dispute-${dispute.id}`,
        type: 'dispute_update',
        title: dispute.status === 'resolved' ? '✅ Impugnación Aceptada' : '❌ Impugnación Rechazada',
        message: `Tu reporte sobre ${dispute.questions.articles.laws.short_name} Art. ${dispute.questions.articles.article_number} ha sido ${dispute.status === 'resolved' ? 'aceptado' : 'rechazado'}.`,
        timestamp: dispute.resolved_at,
        isRead: dispute.is_read || false,
        article: `${dispute.questions.articles.laws.short_name} - Art. ${dispute.questions.articles.article_number}`,
        article_id: dispute.questions.articles.id,
        question_id: dispute.questions.id,
        dispute_status: dispute.status,
        law_short_name: dispute.questions.articles.laws.short_name,
        priority: NOTIFICATION_TYPES.dispute_update.priority,
        ...NOTIFICATION_TYPES.dispute_update
      })) || []

      setDisputeNotifications(notifications)
      return notifications

    } catch (error) {
      console.error('❌ Error cargando impugnaciones:', error)
      setDisputeNotifications([])
      return []
    }
  }

  // 2️⃣ CARGAR ARTÍCULOS PROBLEMÁTICOS - CON SISTEMA CENTRALIZADO Y COOLDOWN
  const loadProblematicArticles = async () => {
    try {
      console.log('🔍 Cargando artículos problemáticos con sistema de cooldown...')
      
      // ✅ Obtener notificaciones descartadas
      const dismissedNotifications = getDismissedNotifications()
      
      // 🆕 Obtener número total de tests completados del usuario
      let totalTestsCompleted = 0
      try {
        const { data: userTestsCount, error: testsError } = await supabase
          .from('tests')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_completed', true)
        
        if (!testsError && userTestsCount) {
          totalTestsCompleted = userTestsCount.length
          console.log(`📊 Usuario ha completado ${totalTestsCompleted} tests en total`)
        }
      } catch (error) {
        console.warn('⚠️ No se pudo obtener el conteo de tests, usando 0 como fallback')
        totalTestsCompleted = 0
      }
      
      // ✅ USAR FUNCIÓN RPC get_user_problematic_articles_weekly - SIMULADA
      let articles = []
      let error = null

      try {
        const { data: rpcArticles, error: rpcError } = await supabase.rpc('get_user_problematic_articles_weekly', {
          user_uuid: user.id  
        })
        
        if (rpcError) {
          console.log('⚠️ Función RPC no disponible, usando consulta directa alternativa')
          
          // Fallback: usar datos disponibles para simular artículos problemáticos
          const { data: testData, error: testError } = await supabase
            .from('tests')
            .select('score, created_at')
            .eq('user_id', user.id)
            .eq('is_completed', true)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('score', { ascending: true })
            .limit(5)
          
          if (!testError && testData && testData.length > 0) {
            // Crear artículos problemáticos simulados basados en scores bajos
            articles = testData
              .filter(test => test.score < 70)
              .map((test, index) => ({
                article_number: `Art. ${10 + index}`, // Simulado
                law_name: 'Ley 19/2013', // Simulado
                law_short_name: 'Ley 19/2013',
                accuracy_percentage: test.score,
                attempts_count: 1,
                difficulty_level: test.score < 30 ? 'extreme' : test.score < 50 ? 'hard' : 'medium'
              }))
          }
        } else {
          articles = rpcArticles
        }
      } catch (err) {
        console.error('❌ Error en carga de artículos problemáticos:', err)
        articles = []
      }

      if (!articles || articles.length === 0) {
        console.log('📭 No se encontraron artículos problemáticos')
        setProblematicArticles([])
        return []
      }

      console.log(`📊 ${articles.length} artículos problemáticos obtenidos (con fallback)`)

      // 🆕 Crear UNA NOTIFICACIÓN SEPARADA POR CADA LEY - CON SISTEMA CENTRALIZADO
      const notifications = []
      
      if (articles && articles.length > 0) {
        console.log(`📊 ${articles.length} artículos problemáticos encontrados`)
        
        // Agrupar artículos por ley CON VALIDACIÓN CENTRALIZADA
        const articlesByLaw = articles.reduce((acc, article) => {
          // 🎯 VALIDAR law_name con sistema centralizado (CORREGIDO: usar law_name, no law_short_name)
          const validatedShortName = validateAndMapLawShortName(
            article.law_name,  // ✅ CORRECTO: usar law_name (campo que existe)
            article.law_name   // ✅ CORRECTO: usar law_name como fallback
          )
          
          if (!acc[validatedShortName]) {
            acc[validatedShortName] = {
              law_short_name: validatedShortName,
              law_full_name: getLawInfo(validatedShortName).name,
              articles: []
            }
          }
          
          // Actualizar el artículo con el short_name validado
          acc[validatedShortName].articles.push({
            ...article,
            law_short_name: validatedShortName
          })
          
          return acc
        }, {})
        
        // 🎯 CREAR NOTIFICACIÓN SEPARADA PARA CADA LEY - CON SISTEMA CENTRALIZADO Y COOLDOWN
        Object.values(articlesByLaw).forEach(lawGroup => {
          const { law_short_name, law_full_name, articles: lawArticles } = lawGroup
          
          // 🔧 VALIDACIÓN FINAL con sistema centralizado
          const finalShortName = validateAndMapLawShortName(law_short_name, law_full_name)
          const lawInfo = getLawInfo(finalShortName) // ✅ Info completa del sistema centralizado
          
          // 🆕 FILTRAR ARTÍCULOS POR COOLDOWN ANTES DE CREAR NOTIFICACIÓN
          const articlesAfterCooldown = lawArticles.filter(article => {
            const shouldShow = shouldShowProblematicArticle(
              user.id,
              finalShortName,
              article.article_number,
              article.accuracy_percentage,
              totalTestsCompleted
            )
            
            if (!shouldShow) {
              console.log(`🕒 Artículo ${finalShortName} Art.${article.article_number} filtrado por cooldown`)
            }
            
            return shouldShow
          })
          
          // Si no quedan artículos después del filtro de cooldown, no crear notificación
          if (articlesAfterCooldown.length === 0) {
            console.log(`🚫 No se creará notificación para ${finalShortName}: todos los artículos están en cooldown`)
            return // Salir de este forEach
          }
          
          const worstArticle = articlesAfterCooldown[0] // El peor de los que pasaron el cooldown
          const articleNumbers = articlesAfterCooldown.map(a => a.article_number).join(',')
          const notificationId = `problematic-law-${finalShortName}-articles-${articleNumbers}`
          console.log('🏗️ Creando notificación:', notificationId)
          console.log('📋 Artículos en notificación tras cooldown:', articlesAfterCooldown.map(a => `Art.${a.article_number}`).join(', '))
          
          // ✅ Solo agregar si no está descartada
          if (!dismissedNotifications.has(notificationId)) {
            console.log(`✅ Creando notificación para ${finalShortName} con ${articlesAfterCooldown.length} artículos`)
            
            // 🆕 GUARDAR COOLDOWN PARA TODOS LOS ARTÍCULOS DE ESTA NOTIFICACIÓN
            articlesAfterCooldown.forEach(article => {
              saveProblematicArticleCooldown(
                user.id, 
                finalShortName, 
                article.article_number, 
                totalTestsCompleted
              )
            })
            
            notifications.push({
              id: notificationId,
              type: 'problematic_articles',
              title: articlesAfterCooldown.length === 1 
                ? `📉 Artículo Problemático: ${finalShortName}` 
                : `📉 ${articlesAfterCooldown.length} Artículos Problemáticos: ${finalShortName}`,
              message: articlesAfterCooldown.length === 1 
                ? `${finalShortName} Art. ${worstArticle.article_number}: ${worstArticle.accuracy_percentage}% de aciertos`
                : `${finalShortName} Arts. ${articleNumbers} con <70% accuracy. El peor: Art. ${worstArticle.article_number} (${worstArticle.accuracy_percentage}%)`,
              timestamp: new Date().toISOString(),
              isRead: false,
              isDismissed: false,
              
              // 🆕 DATOS ESPECÍFICOS CON SISTEMA CENTRALIZADO
              law_short_name: finalShortName,  // ✅ GARANTIZADO válido
              law_full_name: lawInfo.name,     // ✅ Del sistema centralizado
              article: articlesAfterCooldown.length === 1 
                ? `${finalShortName} - Art. ${worstArticle.article_number}` 
                : `${finalShortName} - ${articlesAfterCooldown.length} artículos`,
              accuracy: worstArticle.accuracy_percentage,
              attempts: articlesAfterCooldown.reduce((sum, a) => sum + (a.total_attempts || 0), 0),
              articlesCount: articlesAfterCooldown.length,
              articlesList: articlesAfterCooldown,  // ✅ Todos con law_short_name validado
              
              priority: NOTIFICATION_TYPES.problematic_articles.priority,
              ...NOTIFICATION_TYPES.problematic_articles
            })
          } else {
            console.log(`🚫 Notificación ${notificationId} está descartada, omitiendo`)
          }
        })
      }

      console.log(`✅ ${notifications.length} notificaciones de artículos problemáticos generadas (${dismissedNotifications.size} descartadas)`)
      
      // 🔍 DEBUG: Verificar que no hay undefined con sistema centralizado
      notifications.forEach(notif => {
        if (!notif.law_short_name || notif.law_short_name === 'undefined') {
          console.error(`❌ NOTIFICACIÓN CON LAW_SHORT_NAME INVÁLIDO:`, notif)
        } else {
          // Verificar que el slug generado es válido usando sistema centralizado
          const testSlug = generateLawSlug(notif.law_short_name)
          console.log(`✅ Verificación centralizada: ${notif.law_short_name} → ${testSlug}`)
        }
      })
      
      // Filtrar notificaciones leídas (OPCIÓN B: desaparecen)
      const unreadNotifications = filterUnreadNotifications(notifications)
      setProblematicArticles(unreadNotifications)
      return unreadNotifications

    } catch (error) {
      console.error('❌ Error cargando artículos problemáticos:', error)
      setProblematicArticles([])
      return []
    }
  }

  // 3️⃣ CARGAR RACHAS CON ACCIONES ESPECÍFICAS - ACTUALIZADA CON FILTRO ANTI-REAPACIÓN
  const loadStudyStreaks = async () => {
    try {
      const dismissedNotifications = getDismissedNotifications()
      
      // 🆕 OBTENER NOTIFICACIONES YA MARCADAS COMO LEÍDAS
      const readNotificationsKey = `read_notifications_${user?.id || 'anonymous'}`
      const readNotifications = JSON.parse(localStorage.getItem(readNotificationsKey) || '{}')
      
      const { data: analytics, error } = await supabase
        .from('user_learning_analytics')
        .select('current_streak_days, longest_streak_days, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      const notifications = []
      
      if (analytics) {
        const streakDays = analytics.current_streak_days || 0
        
        // 🔥 Racha activa - SOLO HITOS IMPORTANTES (5, 10, 20, 30, 50, 100 días)
        const streakMilestones = [5, 10, 20, 30, 50, 100, 200, 365]
        const currentMilestone = streakMilestones.find(milestone => streakDays === milestone)
        
        if (currentMilestone && canShowAchievement(user.id)) {
          const notificationId = `streak-milestone-${currentMilestone}`
          const isAlreadyRead = !!readNotifications[notificationId]
          
          if (!dismissedNotifications.has(notificationId) && !isAlreadyRead) {
            // Mensaje personalizado según el hito
            let title = '🔥 Racha de Estudio'
            let message = `¡${currentMilestone} días seguidos estudiando! ¿Continuamos?`
            
            if (currentMilestone >= 100) {
              title = '🏆 ¡Racha Legendaria!'
              message = `¡Increíble! ${currentMilestone} días seguidos. ¡Eres una máquina de estudiar!`
            } else if (currentMilestone >= 50) {
              title = '🌟 ¡Racha Épica!'
              message = `¡Impresionante! ${currentMilestone} días seguidos. ¡Estás imparable!`
            } else if (currentMilestone >= 20) {
              title = '💪 ¡Racha Sólida!'
              message = `¡Excelente! ${currentMilestone} días seguidos. ¡La constancia es clave!`
            } else if (currentMilestone >= 10) {
              title = '🚀 ¡Gran Racha!'
              message = `¡Genial! ${currentMilestone} días seguidos. ¡Vas por buen camino!`
            }
            
            // 🆕 Registrar logro mostrado
            recordAchievementShown(user.id)
            
            notifications.push({
              id: notificationId,
              type: 'study_streak',
              title,
              message,
              timestamp: analytics.updated_at,
              isRead: false,
              streak_days: currentMilestone,
              priority: NOTIFICATION_TYPES.study_streak.priority,
              ...NOTIFICATION_TYPES.study_streak
            })
          } else if (isAlreadyRead) {
            console.log(`🚫 Notificación de racha ${notificationId} ya marcada como leída, no recreando`)
          }
        }

        // Nuevo récord de racha
        if (streakDays > 0 && streakDays === analytics.longest_streak_days && streakDays >= 5) {
          const notificationId = `streak-record-${streakDays}`
          
          if (!dismissedNotifications.has(notificationId)) {
            notifications.push({
              id: notificationId,
              type: 'achievement',
              title: '🏆 ¡Nuevo Récord de Racha!',
              message: `¡${streakDays} días es tu nueva mejor racha! ¿Subimos el listón?`,
              timestamp: analytics.updated_at,
              isRead: false,
              streak_days: streakDays,
              priority: NOTIFICATION_TYPES.achievement.priority,
              ...NOTIFICATION_TYPES.achievement
            })
          }
        }
      }

      // Filtrar notificaciones leídas (OPCIÓN B: desaparecen)
      const unreadNotifications = filterUnreadNotifications(notifications)
      setStudyStreaks(unreadNotifications)
      return unreadNotifications

    } catch (error) {
      console.error('❌ Error cargando rachas:', error)
      setStudyStreaks([])
      return []
    }
  }

  // 4️⃣ CARGAR LOGROS CON ACCIONES ESPECÍFICAS - ACTUALIZADA CON FILTRO ANTI-REAPACIÓN
  const loadAchievements = async () => {
    try {
      const dismissedNotifications = getDismissedNotifications()
      
      // 🆕 OBTENER NOTIFICACIONES YA MARCADAS COMO LEÍDAS
      const readNotificationsKey = `read_notifications_${user?.id || 'anonymous'}`
      const readNotifications = JSON.parse(localStorage.getItem(readNotificationsKey) || '{}')
      
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: weeklyStats, error } = await supabase
        .from('tests')
        .select('id, score, completed_at, tema_number')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .gte('completed_at', weekAgo);

      if (error) throw error;

      const notifications = [];
      const testsThisWeek = weeklyStats?.length || 0;

      // 🏆 Logro: Tests semanales - SOLO RANGOS FIJOS (10, 25, 50, 100)
      const weeklyMilestones = [10, 25, 50, 100, 200]
      const currentWeeklyMilestone = weeklyMilestones.find(milestone => testsThisWeek === milestone)
      
      if (currentWeeklyMilestone && canShowAchievement(user.id)) {
        const notificationId = `achievement-weekly-milestone-${currentWeeklyMilestone}`
        const isAlreadyRead = !!readNotifications[notificationId]
        
        if (!dismissedNotifications.has(notificationId) && !isAlreadyRead) {
          // Mensaje personalizado según el hito semanal
          let title = '🏆 ¡Gran Semana de Estudio!'
          let message = `¡Completaste ${currentWeeklyMilestone} tests esta semana!`
          
          if (currentWeeklyMilestone >= 100) {
            title = '🎖️ ¡Semana Legendaria!'
            message = `¡Increíble! ${currentWeeklyMilestone} tests en una semana. ¡Eres imparable!`
          } else if (currentWeeklyMilestone >= 50) {
            title = '🌟 ¡Semana Épica!'
            message = `¡Impresionante! ${currentWeeklyMilestone} tests esta semana. ¡Nivel pro!`
          } else if (currentWeeklyMilestone >= 25) {
            title = '🚀 ¡Semana Intensiva!'
            message = `¡Excelente! ${currentWeeklyMilestone} tests esta semana. ¡Gran dedicación!`
          }
          
          // 🆕 Registrar logro mostrado
          recordAchievementShown(user.id)
          
          notifications.push({
            id: notificationId,
            type: 'achievement',
            title,
            message,
            timestamp: new Date().toISOString(),
            isRead: false,
            tests_count: currentWeeklyMilestone,
            priority: NOTIFICATION_TYPES.achievement.priority,
            ...NOTIFICATION_TYPES.achievement
          });
        } else if (isAlreadyRead) {
          console.log(`🚫 Notificación de logro semanal ${notificationId} ya marcada como leída, no recreando`)
        }
      }

      // Mejora: promedio alto esta semana
      if (weeklyStats?.length >= 5) {
        const avgScore = weeklyStats.reduce((sum, test) => sum + (test.score || 0), 0) / weeklyStats.length;
        const mostCommonTema = weeklyStats.reduce((acc, test) => {
          acc[test.tema_number] = (acc[test.tema_number] || 0) + 1;
          return acc;
        }, {});
        const mainTema = Object.keys(mostCommonTema).reduce((a, b) => mostCommonTema[a] > mostCommonTema[b] ? a : b);
        
        // 📈 Solo notificar mejoras significativas en rangos de 5 puntos (80, 85, 90, 95)
        const scoreMilestones = [80, 85, 90, 95, 98]
        const currentScoreMilestone = scoreMilestones.find(milestone => 
          avgScore >= milestone && avgScore < milestone + 5
        )
        
        if (currentScoreMilestone && canShowAchievement(user.id)) {
          const notificationId = `improvement-milestone-${currentScoreMilestone}`
          const isAlreadyRead = !!readNotifications[notificationId]
          
          if (!dismissedNotifications.has(notificationId) && !isAlreadyRead) {
            // Mensaje personalizado según el nivel de rendimiento
            let title = '📈 Excelente Rendimiento Semanal'
            let message = `Promedio de ${Math.round(avgScore)}% esta semana. ¡Vamos a consolidarlo!`
            
            if (currentScoreMilestone >= 95) {
              title = '🎯 ¡Rendimiento Perfecto!'
              message = `¡Increíble! Promedio de ${Math.round(avgScore)}% esta semana. ¡Estás listo para el examen!`
            } else if (currentScoreMilestone >= 90) {
              title = '⭐ ¡Rendimiento Excelente!'
              message = `¡Impresionante! ${Math.round(avgScore)}% de promedio. ¡Sigue así!`
            } else if (currentScoreMilestone >= 85) {
              title = '🚀 ¡Gran Rendimiento!'
              message = `¡Excelente! ${Math.round(avgScore)}% de promedio. ¡Vas muy bien!`
            }
            
            // 🆕 Registrar logro mostrado
            recordAchievementShown(user.id)
            
            notifications.push({
              id: notificationId,
              type: 'improvement',
              title,
              message,
              timestamp: new Date().toISOString(),
              isRead: false,
              avg_score: Math.round(avgScore),
              tema_number: parseInt(mainTema) || 7,
              improvement_percentage: Math.round(avgScore),
              priority: NOTIFICATION_TYPES.improvement.priority,
              ...NOTIFICATION_TYPES.improvement
            });
          } else if (isAlreadyRead) {
            console.log(`🚫 Notificación de mejora de score ${notificationId} ya marcada como leída, no recreando`)
          }
        }
      }

      // Filtrar notificaciones leídas (OPCIÓN B: desaparecen)
      const unreadNotifications = filterUnreadNotifications(notifications)
      setAchievements(unreadNotifications);
      return unreadNotifications;

    } catch (error) {
      console.error('❌ Error cargando logros:', error);
      setAchievements([]);
      return [];
    }
  };

  // 5️⃣ CARGAR RECORDATORIOS DE ESTUDIO CON ACCIONES - ACTUALIZADA CON FILTRO ANTI-REAPACIÓN
  const loadStudyReminders = async () => {
    try {
      const dismissedNotifications = getDismissedNotifications()
      
      // 🆕 OBTENER NOTIFICACIONES YA MARCADAS COMO LEÍDAS
      const readNotificationsKey = `read_notifications_${user?.id || 'anonymous'}`
      const readNotifications = JSON.parse(localStorage.getItem(readNotificationsKey) || '{}')
      
      const { data: lastTest, error } = await supabase
        .from('tests')
        .select('completed_at')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const notifications = [];

      if (lastTest) {
        const daysSinceLastTest = Math.floor(
          (new Date() - new Date(lastTest.completed_at)) / (1000 * 60 * 60 * 24)
        );

        // Recordatorio por inactividad (2+ días)
        if (daysSinceLastTest >= 2) {
          const isUrgent = daysSinceLastTest >= 5;
          
          // ✅ FIX: Usar ID base sin días para evitar notificaciones diarias repetidas
          const baseNotificationId = isUrgent ? 'reminder-streak-broken' : 'reminder-inactive'
          
          // Verificar cooldown desde la última vez que se marcó como leída
          const lastReadKey = `${baseNotificationId}-last-read`
          const lastRead = readNotifications[lastReadKey]
          const daysSinceLastRead = lastRead ? 
            Math.floor((new Date() - new Date(lastRead)) / (1000 * 60 * 60 * 24)) : 
            999 // Si nunca se ha leído
          
          // Cooldown de 3 días para racha rota, 2 días para inactividad normal
          const cooldownDays = isUrgent ? 3 : 2
          const isInCooldown = daysSinceLastRead < cooldownDays
          
          const notificationId = baseNotificationId // Usar ID base consistente
          const isAlreadyRead = !!readNotifications[notificationId]
          
          if (!dismissedNotifications.has(notificationId) && !isAlreadyRead && !isInCooldown) {
            notifications.push({
              id: notificationId,
              type: isUrgent ? 'streak_broken' : 'inactive_reminder',
              title: isUrgent ? '💔 ¡Racha Rota!' : '😴 Te Echamos de Menos',
              message: isUrgent 
                ? `Llevas ${daysSinceLastTest} días sin estudiar. ¡Vamos a recuperar el ritmo!`
                : `Han pasado ${daysSinceLastTest} días desde tu último test. ¿Un repaso rápido?`,
              timestamp: new Date().toISOString(),
              isRead: false,
              days_inactive: daysSinceLastTest,
              priority: isUrgent ? NOTIFICATION_TYPES.streak_broken.priority : 75,
              ...(isUrgent ? NOTIFICATION_TYPES.streak_broken : {
                icon: '😴',
                color: 'orange',
                bgColor: 'bg-orange-100 dark:bg-orange-900/50',
                textColor: 'text-orange-600 dark:text-orange-400',
                borderColor: 'border-orange-200 dark:border-orange-800',
                primaryAction: {
                  label: '🚀 Test Rápido (3 min)',
                  type: 'quick_test'
                },
                secondaryAction: {
                  label: '📊 Ver Mi Progreso',
                  type: 'view_stats'
                }
              })
            });
          }
        }
      }

      // Filtrar notificaciones leídas (OPCIÓN B: desaparecen)
      const unreadNotifications = filterUnreadNotifications(notifications)
      setStudyReminders(unreadNotifications);
      return unreadNotifications;

    } catch (error) {
      console.error('❌ Error cargando recordatorios:', error);
      setStudyReminders([]);
      return [];
    }
  };

  // 6️⃣ CARGAR ACTUALIZACIONES DE PROGRESO CON ACCIONES - ACTUALIZADA CON FILTRO ANTI-REAPACIÓN
  const loadProgressUpdates = async () => {
    try {
      const dismissedNotifications = getDismissedNotifications()
      
      // 🆕 OBTENER NOTIFICACIONES YA MARCADAS COMO LEÍDAS
      const readNotificationsKey = `read_notifications_${user?.id || 'anonymous'}`
      const readNotifications = JSON.parse(localStorage.getItem(readNotificationsKey) || '{}')
      
      const { data: analytics, error } = await supabase
        .from('user_learning_analytics')
        .select('tema_number, overall_accuracy, mastery_level, updated_at')
        .eq('user_id', user.id)
        .not('tema_number', 'is', null)
        .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const notifications = [];

      // Buscar temas con alto dominio (>85%)
      analytics?.forEach(tema => {
        if (tema.overall_accuracy >= 85 && tema.mastery_level === 'advanced') {
          const notificationId = `progress-mastery-tema-${tema.tema_number}`
          
          // 🚫 NO CREAR si está descartada O ya marcada como leída
          const isAlreadyRead = !!readNotifications[notificationId]
          
          if (!dismissedNotifications.has(notificationId) && !isAlreadyRead) {
            notifications.push({
              id: notificationId,
              type: 'progress_update',
              title: '📊 Tema Dominado',
              message: `Tema ${tema.tema_number}: ${Math.round(tema.overall_accuracy)}% de dominio. ¿Ponemos a prueba tu maestría?`,
              timestamp: tema.updated_at,
              isRead: false,
              tema_number: tema.tema_number,
              accuracy: Math.round(tema.overall_accuracy),
              priority: NOTIFICATION_TYPES.progress_update.priority,
              ...NOTIFICATION_TYPES.progress_update
            });
          } else if (isAlreadyRead) {
            console.log(`🚫 Notificación ${notificationId} ya marcada como leída, no recreando`)
          }
        }
      });

      console.log(`📊 Progreso: ${notifications.length} notificaciones creadas (filtradas por dismissed + leídas)`)
      
      // Filtrar notificaciones leídas (OPCIÓN B: desaparecen) - doble verificación
      const unreadNotifications = filterUnreadNotifications(notifications)
      setProgressUpdates(unreadNotifications);
      return unreadNotifications;

    } catch (error) {
      console.error('❌ Error cargando progreso:', error);
      setProgressUpdates([]);
      return [];
    }
  };

  // 7️⃣ CARGAR NOTIFICACIONES DEL SISTEMA (desde tabla notifications)
  const loadSystemNotifications = async () => {
    try {
      const dismissedNotifications = getDismissedNotifications()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: notifications, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('user_id', user.id)
        .is('opened_at', null)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      console.log('📧 Notificaciones encontradas:', notifications?.length || 0, notifications)

      const systemNotifs = notifications?.map(notif => ({
        id: `system-${notif.id}`,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        timestamp: notif.created_at,
        isRead: notif.is_read,
        data: notif.data,
        priority: NOTIFICATION_TYPES[notif.type]?.priority || 30,
        ...(NOTIFICATION_TYPES[notif.type] || {
          icon: '💬',
          color: 'blue',
          bgColor: 'bg-blue-100 dark:bg-blue-900/50',
          textColor: 'text-blue-600 dark:text-blue-400',
          borderColor: 'border-blue-200 dark:border-blue-800'
        })
      })).filter(notif => !dismissedNotifications.has(notif.id)) || []

      const unreadNotifications = filterUnreadNotifications(systemNotifs)
      console.log('📧 System notifications después de filtros:', unreadNotifications.length, unreadNotifications)
      setSystemNotifications(unreadNotifications)
      return unreadNotifications

    } catch (error) {
      // Silenciar el error si la tabla no existe
      if (error?.code === '42P01') {
        console.warn('⚠️ Tabla notifications no existe, omitiendo notificaciones del sistema')
      } else {
        console.error('❌ Error cargando notificaciones del sistema:', error)
      }
      setSystemNotifications([])
      return []
    }
  }

  // 8️⃣ CARGAR NOTIFICACIONES MOTIVACIONALES (solo cuando no hay urgentes)
  const loadMotivationalNotifications = async () => {
    try {
      if (!user?.id || !supabase) {
        console.log('❌ Usuario o supabase no disponible para notificaciones motivacionales')
        return []
      }


      // Crear instancia del analizador motivacional
      const analyzer = new MotivationalAnalyzer(supabase, user.id)

      // Generar notificaciones motivacionales basadas en datos reales
      const motivationalNotifs = await analyzer.generateMotivationalNotifications()


      // Filtrar notificaciones leídas y descartadas  
      const unreadMotivationalNotifs = filterUnreadNotifications(motivationalNotifs)
      
      // 🆕 ENVIAR AUTOMÁTICAMENTE LAS NOTIFICACIONES NUEVAS (push + email fallback)
      for (const notification of unreadMotivationalNotifs) {
        // Solo enviar si es realmente nueva (no la hemos visto antes)
        const notificationId = `${notification.type}-${notification.timestamp || Date.now()}`
        const hasBeenSent = localStorage.getItem(`sent_notification_${notificationId}`)
        
        if (!hasBeenSent) {
          try {
            await sendNotificationWithFallback(user, notification)
            // Marcar como enviada para no repetir
            localStorage.setItem(`sent_notification_${notificationId}`, 'true')
          } catch (error) {
            console.error('❌ Error enviando notificación motivacional:', error)
          }
        }
      }
      
      setMotivationalNotifications(unreadMotivationalNotifs)
      return unreadMotivationalNotifs

    } catch (error) {
      console.error('❌ Error cargando notificaciones motivacionales:', error)
      setMotivationalNotifications([])
      return []
    }
  }

  // Función para resetear notificaciones
  const resetNotifications = () => {
    setAllNotifications([]);
    setDisputeNotifications([]);
    setProblematicArticles([]);
    setStudyStreaks([]);
    setAchievements([]);
    setStudyReminders([]);
    setProgressUpdates([]);
    setMotivationalNotifications([]);
    setSystemNotifications([]);
    setLoading(false);
  };

  // Combinar y ordenar todas las notificaciones por prioridad
  useEffect(() => {
    const combined = [
      ...disputeNotifications,
      ...problematicArticles,
      ...studyStreaks,
      ...achievements,
      ...studyReminders,
      ...progressUpdates,
      ...motivationalNotifications,
      ...systemNotifications
    ].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    setAllNotifications(combined);
  }, [disputeNotifications, problematicArticles, studyStreaks, achievements, studyReminders, progressUpdates, motivationalNotifications, systemNotifications]);

  // Calcular contadores
  const unreadCount = allNotifications.filter(n => !n.isRead).length;
  const categorizedNotifications = {
    critical: allNotifications.filter(n => n.priority >= 90),
    important: allNotifications.filter(n => n.priority >= 70 && n.priority < 90),
    recommendations: allNotifications.filter(n => n.priority >= 50 && n.priority < 70),
    info: allNotifications.filter(n => n.priority < 50)
  };

  // Función para marcar como leída (OPCIÓN B: desaparece de la campana)
  const markAsRead = async (notificationId) => {
    try {
      console.log('🗑️ Marcando como leída (desaparecerá):', notificationId)
      
      if (notificationId.startsWith('dispute-')) {
        // Para impugnaciones: marcar en BD
        const disputeId = notificationId.replace('dispute-', '');
        const { error } = await supabase
          .from('question_disputes')
          .update({ is_read: true })
          .eq('id', disputeId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Remover inmediatamente de la lista local
        setDisputeNotifications(prev => {
          const updated = prev.filter(notification => notification.id !== notificationId);
          console.log('✅ Impugnación removida. Antes:', prev.length, 'Después:', updated.length);
          return updated;
        });
        
        // También remover de la lista general de notificaciones
        setAllNotifications(prev => {
          const updated = prev.filter(notification => notification.id !== notificationId);
          console.log('📝 Lista general actualizada. Antes:', prev.length, 'Después:', updated.length);
          return updated;
        });
      }
      else if (notificationId.startsWith('system-')) {
        // Para notificaciones del sistema: marcar en BD
        const systemNotifId = notificationId.replace('system-', '');
        const { error } = await supabase
          .from('notification_logs')
          .update({ opened_at: new Date().toISOString() })
          .eq('id', systemNotifId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Remover inmediatamente de la lista local
        setSystemNotifications(prev => {
          const updated = prev.filter(notification => notification.id !== notificationId);
          console.log('✅ Notificación del sistema removida. Antes:', prev.length, 'Después:', updated.length);
          return updated;
        });
      }
      else {
        // Para otros tipos: marcar en localStorage
        const readNotificationsKey = `read_notifications_${user?.id || 'anonymous'}`
        const readNotifications = JSON.parse(localStorage.getItem(readNotificationsKey) || '{}')
        
        // Agregar la notificación como leída with timestamp
        readNotifications[notificationId] = {
          readAt: new Date().toISOString(),
          userId: user?.id
        }
        
        // ✅ FIX: Para notificaciones de racha rota/inactividad, guardar cooldown
        if (notificationId === 'reminder-streak-broken' || notificationId === 'reminder-inactive') {
          const cooldownKey = `${notificationId}-last-read`
          readNotifications[cooldownKey] = new Date().toISOString()
          console.log(`💾 Cooldown iniciado para ${cooldownKey}`)
        }
        
        // Guardar en localStorage
        localStorage.setItem(readNotificationsKey, JSON.stringify(readNotifications))
        console.log('💾 Notificación marcada como leída y removida de UI:', notificationId)
        
        // Remover inmediatamente de todas las listas locales
        const notification = allNotifications.find(n => n.id === notificationId)
        if (notification) {
          switch (notification.type) {
            case 'problematic_articles':
              setProblematicArticles(prev => 
                prev.filter(n => n.id !== notificationId)
              );
              break;
            case 'study_streak':
            case 'streak_broken':
              setStudyStreaks(prev => 
                prev.filter(n => n.id !== notificationId)
              );
              break;
            case 'achievement':
              setAchievements(prev => 
                prev.filter(n => n.id !== notificationId)
              );
              break;
            case 'level_regression':
              setStudyReminders(prev => 
                prev.filter(n => n.id !== notificationId)
              );
              break;
            case 'progress_update':
            case 'improvement':
              setProgressUpdates(prev => 
                prev.filter(n => n.id !== notificationId)
              );
              break;
            case 'daily_progress':
            case 'accuracy_improvement':
            case 'speed_improvement':
            case 'articles_mastered':
            case 'study_consistency':
            case 'learning_variety':
            case 'feedback_response':
              setMotivationalNotifications(prev => 
                prev.filter(n => n.id !== notificationId)
              );
              break;
          }
        }
      }

    } catch (error) {
      console.error('❌ Error marcando como leída:', error);
    }
  };

  // Función para descartar notificación - ACTUALIZADA CON PERSISTENCIA
  const dismissNotification = (notificationId) => {
    console.log('🗑️ Descartando notificación:', notificationId);
    
    // ✅ NUEVO: Guardar en localStorage para persistencia
    saveDismissedNotification(notificationId)
    
    // Actualizar estado local para ocultar la notificación
    setAllNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, isDismissed: true }
          : notification
      ).filter(notification => !notification.isDismissed) // Filtrar las descartadas
    );
    
    // También actualizar los arrays específicos
    setProblematicArticles(prev => prev.filter(n => n.id !== notificationId));
    setStudyStreaks(prev => prev.filter(n => n.id !== notificationId));
    setAchievements(prev => prev.filter(n => n.id !== notificationId));
    setStudyReminders(prev => prev.filter(n => n.id !== notificationId));
    setProgressUpdates(prev => prev.filter(n => n.id !== notificationId));
    setMotivationalNotifications(prev => prev.filter(n => n.id !== notificationId));
    setSystemNotifications(prev => prev.filter(n => n.id !== notificationId));
    setDisputeNotifications(prev => prev.filter(n => n.id !== notificationId)); // ¡FALTABA ESTO!
  };

  // 🆕 FUNCIÓN PARA OBTENER ACCIONES DE UNA NOTIFICACIÓN
  const getNotificationActions = (notification) => {
    const notificationType = NOTIFICATION_TYPES[notification.type];
    if (!notificationType) return { primary: null, secondary: null };

    // Generar label dinámico para el botón primario
    let primaryLabel = notificationType.primaryAction?.label || 'Ver más';
    
    // Para artículos problemáticos, usar el MISMO cálculo que en generateActionUrl
    if (notification.type === 'problematic_articles' && notification.articlesCount) {
      const actualQuestionCount = Math.min(notification.articlesCount * 2, 10);
      primaryLabel = `🔥 Test Intensivo (${actualQuestionCount} preguntas)`;
    }

    return {
      primary: {
        label: primaryLabel,
        url: generateActionUrl(notification, notificationType.primaryAction?.type || 'default'),
        type: notificationType.primaryAction?.type || 'default'
      },
      secondary: notificationType.secondaryAction ? {
        label: notificationType.secondaryAction.label,
        url: generateActionUrl(notification, notificationType.secondaryAction.type),
        type: notificationType.secondaryAction.type
      } : null
    };
  };

  // 🆕 FUNCIÓN PARA OBTENER ESTADÍSTICAS DE ACCIONES
  const getActionStats = () => {
    return {
      totalNotifications: allNotifications.length,
      criticalCount: categorizedNotifications.critical.length,
      importantCount: categorizedNotifications.important.length,
      recommendationsCount: categorizedNotifications.recommendations.length,
      infoCount: categorizedNotifications.info.length,
      hasActions: allNotifications.filter(n => NOTIFICATION_TYPES[n.type]?.primaryAction).length
    };
  };

  // 🛠️ FUNCIONES PARA DEBUGGING Y GESTIÓN
  const clearDismissedNotifications = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DISMISSED_NOTIFICATIONS_KEY)
        console.log('🧹 Notificaciones descartadas limpiadas')
        loadAllNotifications() // Recargar para mostrar todas
      }
    } catch (error) {
      console.error('Error limpiando notificaciones descartadas:', error)
    }
  };

  const getDismissedStats = () => {
    const dismissed = getDismissedNotifications()
    console.log('📊 Notificaciones descartadas:', {
      count: dismissed.size,
      notifications: Array.from(dismissed)
    })
    return dismissed
  };

  return {
    // Estados principales
    notifications: allNotifications,
    unreadCount,
    loading,
    lastUpdate,
    
    // Por categorías
    categorizedNotifications,
    
    // Por tipo específico
    disputeNotifications,
    problematicArticles,
    studyStreaks,
    achievements,
    studyReminders,
    progressUpdates,
    motivationalNotifications,
    systemNotifications,
    
    // 🆕 FUNCIONES DE ACCIÓN
    executeAction,              // Ejecutar acción primaria o secundaria
    getNotificationActions,     // Obtener acciones disponibles para una notificación
    generateActionUrl,          // Generar URL específica para una acción
    getActionStats,             // Estadísticas de acciones disponibles
    
    // Funciones existentes
    loadAllNotifications,
    markAsRead,
    dismissNotification,
    
    // 🛠️ NUEVAS FUNCIONES DE GESTIÓN
    clearDismissedNotifications, // Para debugging: limpiar todas las descartadas
    getDismissedStats,          // Para debugging: ver estadísticas
    
    // Configuración
    notificationTypes: NOTIFICATION_TYPES
  };
}

export default useIntelligentNotifications;

// 🆕 HELPER: Función para formatear tiempo estimado de acción
export const getActionTimeEstimate = (actionType) => {
  const timeEstimates = {
    'directed_test': '5 min',
    'intensive_test': '8 min',
    'quick_test': '3 min',
    'maintain_streak': '5 min',
    'next_challenge': '10 min',
    'consolidate_improvement': '7 min',
    'advanced_test': '12 min',
    'explore_content': '2 min',
    'view_theory': '3 min',
    'view_stats': '1 min',
    'view_progress': '1 min',
    'detailed_analysis': '2 min',
    'view_achievements': '1 min',
    'view_disputes': '1 min',
    'view_corrected_question': '2 min',
    'view_details': '1 min',
    'view_changelog': '2 min',
    'open_chat': '1 min',
    'view_feedback': '1 min'
  };
  
  return timeEstimates[actionType] || '';
};

// 🆕 HELPER: Función para obtener descripción de la acción
export const getActionDescription = (actionType) => {
  const descriptions = {
    'directed_test': 'Test enfocado en artículos problemáticos',
    'intensive_test': 'Test intensivo para reforzar conocimientos',
    'quick_test': 'Test rápido para retomar el ritmo',
    'maintain_streak': 'Test corto para mantener la racha',
    'next_challenge': 'Desafío más avanzado',
    'consolidate_improvement': 'Consolidar la mejora obtenida',
    'advanced_test': 'Test avanzado para demostrar maestría',
    'explore_content': 'Descubrir nuevo contenido añadido',
    'view_theory': 'Repasar la teoría del artículo',
    'view_stats': 'Ver estadísticas detalladas',
    'view_progress': 'Analizar progreso reciente',
    'detailed_analysis': 'Análisis detallado de rendimiento',
    'view_achievements': 'Ver todos los logros obtenidos',
    'view_disputes': 'Gestionar impugnaciones',
    'view_corrected_question': 'Ver pregunta corregida',
    'view_details': 'Ver detalles del progreso',
    'view_changelog': 'Ver novedades y actualizaciones',
    'open_chat': 'Abrir conversación de feedback',
    'view_feedback': 'Ver feedback enviado'
  };
  
  return descriptions[actionType] || 'Realizar acción';
};

// 🆕 HELPER: Función para obtener icono de acción
export const getActionIcon = (actionType) => {
  const icons = {
    'directed_test': '🎯',
    'intensive_test': '🔥',
    'quick_test': '⚡',
    'maintain_streak': '🚀',
    'next_challenge': '🏆',
    'consolidate_improvement': '💪',
    'advanced_test': '🎖️',
    'explore_content': '🔍',
    'view_theory': '📖',
    'view_stats': '📊',
    'view_progress': '📈',
    'detailed_analysis': '🔬',
    'view_achievements': '🏆',
    'view_disputes': '📋',
    'view_corrected_question': '✅',
    'view_details': '📋',
    'view_changelog': '🆕',
    'open_chat': '💬',
    'view_feedback': '📝'
  };
  
  return icons[actionType] || '👆';
};

