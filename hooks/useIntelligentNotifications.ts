// @ts-nocheck - TODO: Migrar tipos gradualmente (archivo complejo con muchas dependencias)
// hooks/useIntelligentNotifications.ts - SISTEMA COMPLETO DE NOTIFICACIONES INTELIGENTES CON PERSISTENCIA Y EMAIL FALLBACK
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  mapLawSlugToShortName,
  generateLawSlug,
  getLawInfo
} from '../lib/lawMappingUtils'
import { MotivationalAnalyzer } from '../lib/notifications/motivationalAnalyzer'
import type {
  Notification,
  NotificationTypeId,
  NotificationTypesMap,
  NotificationAction,
  CategorizedNotifications,
  CooldownData,
  DismissedNotificationsData,
  ReadNotificationsData,
  NotificationEmailPayload,
  UseIntelligentNotificationsReturn
} from './useIntelligentNotifications.types'
import type { User, SupabaseClient } from '@supabase/supabase-js'

// Tipo para el contexto de autenticación (AuthContext.js no está tipado)
interface AuthContextValue {
  user: User | null
  userProfile: { id: string; [key: string]: unknown } | null
  supabase: SupabaseClient
  loading: boolean
}

// 🧪 GLOBAL TEST NOTIFICATIONS MANAGER (solo desarrollo)
let globalTestNotifications: Notification[] = []
let globalTestNotificationsListeners: Array<(notifications: Notification[]) => void> = []

const addGlobalTestNotificationsListener = (listener: (notifications: Notification[]) => void): void => {
  if (process.env.NODE_ENV === 'development') {
    globalTestNotificationsListeners.push(listener)
  }
}

const removeGlobalTestNotificationsListener = (listener: (notifications: Notification[]) => void): void => {
  if (process.env.NODE_ENV === 'development') {
    globalTestNotificationsListeners = globalTestNotificationsListeners.filter(l => l !== listener)
  }
}

const updateGlobalTestNotifications = (notifications: Notification[]): void => {
  if (process.env.NODE_ENV === 'development') {
    globalTestNotifications = notifications
    globalTestNotificationsListeners.forEach(listener => listener(notifications))
  }
}

// 🆕 FUNCIÓN PARA ENVIAR EMAIL FALLBACK DE MENSAJES MOTIVACIONALES
async function sendMotivationalEmail(user: User, notification: Notification): Promise<boolean> {
  try {
    console.log('📧 Enviando email motivacional fallback:', notification.type)
    
    // Validar datos antes de enviar
    if (!user?.email) {
      throw new Error('User email is missing')
    }
    if (!notification?.type) {
      throw new Error('Notification type is missing')
    }
    if (!notification?.title) {
      throw new Error('Notification title is missing')
    }
    // Las notificaciones usan el campo 'message' no 'body'
    const notificationBody = notification.body || notification.message
    if (!notificationBody) {
      throw new Error('Notification body/message is missing')
    }
    
    // Validación adicional para campos vacíos
    if (notification.title.trim() === '' || notificationBody.trim() === '') {
      throw new Error('Notification title or body is empty')
    }
    
    const payload = {
      userEmail: user.email,
      userName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
      messageType: notification.type,
      title: notification.title,
      body: notificationBody, // Usar el campo correcto
      primaryAction: notification.primaryAction,
      secondaryAction: notification.secondaryAction,
      userId: user.id
    }
    
    console.log('📧 Payload a enviar:', JSON.stringify(payload, null, 2))
    
    const response = await fetch('/api/send-motivational-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
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
async function sendNotificationWithFallback(user: User, notification: Notification): Promise<boolean> {
  // Primero intentar notificación push
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      // Las notificaciones pueden usar 'message' o 'body'
      const notificationBody = notification.body || notification.message
      new Notification(notification.title, {
        body: notificationBody,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
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
const DISMISSED_NOTIFICATIONS_KEY = 'dismissed_notifications_v2'
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
const MOTIVATIONAL_COOLDOWN_DAYS = 14 // Cooldown de 14 días para notificaciones motivacionales
const MOTIVATIONAL_COOLDOWN_KEY = 'vence_motivational_cooldowns'

// Obtener notificaciones descartadas del localStorage
const getDismissedNotifications = (): Set<string> => {
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
const saveDismissedNotification = (notificationId: string): void => {
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
const getProblematicArticlesCooldown = (userId: string): Record<string, CooldownData> => {
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

const saveProblematicArticleCooldown = (userId: string, lawShortName: string, articleNumber: string, testsCompleted: number): void => {
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

const shouldShowProblematicArticle = (userId: string, lawShortName: string, articleNumber: string, accuracy: number, currentTestsCompleted: number): boolean => {
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
  // Logs de cooldown comentados para reducir spam
  // console.log(`🚫 NO mostrar ${articleKey}: Faltan ${Math.ceil(remainingDays)} días o ${remainingTests} tests`)
  return false
}

// 🆕 FUNCIONES PARA COOLDOWN GLOBAL DE LOGROS
interface AchievementCooldownState {
  count: number
  lastReset: number
}

const getAchievementCooldown = (userId: string): AchievementCooldownState => {
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

const canShowAchievement = (userId: string): boolean => {
  const cooldownData = getAchievementCooldown(userId)
  const canShow = cooldownData.count < DAILY_ACHIEVEMENT_LIMIT
  
  if (!canShow) {
    console.log(`🚫 Cooldown global de logros: ${cooldownData.count}/${DAILY_ACHIEVEMENT_LIMIT} por hoy`)
  }
  
  return canShow
}

const recordAchievementShown = (userId: string): void => {
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

// 🆕 FUNCIONES PARA COOLDOWN DE NOTIFICACIONES MOTIVACIONALES (14 días)
interface MotivationalCooldownEntry {
  dismissedAt: number
  cooldownDays: number
}

const getMotivationalCooldown = (userId: string, notificationType: string): MotivationalCooldownEntry | null => {
  try {
    if (typeof window === 'undefined') return null
    
    const stored = localStorage.getItem(`${MOTIVATIONAL_COOLDOWN_KEY}_${userId}`)
    if (!stored) return null
    
    const data = JSON.parse(stored)
    return data[notificationType] || null
  } catch (error) {
    console.error('Error obteniendo cooldown motivacional:', error)
    return null
  }
}

const setMotivationalCooldown = (userId: string, notificationType: string): void => {
  try {
    if (typeof window === 'undefined') return
    
    const stored = localStorage.getItem(`${MOTIVATIONAL_COOLDOWN_KEY}_${userId}`)
    const data = stored ? JSON.parse(stored) : {}
    
    data[notificationType] = {
      dismissedAt: Date.now(),
      cooldownDays: MOTIVATIONAL_COOLDOWN_DAYS
    }
    
    localStorage.setItem(`${MOTIVATIONAL_COOLDOWN_KEY}_${userId}`, JSON.stringify(data))
    console.log(`⏰ Cooldown de ${MOTIVATIONAL_COOLDOWN_DAYS} días activado para ${notificationType}`)
  } catch (error) {
    console.error('Error estableciendo cooldown motivacional:', error)
  }
}

const isInMotivationalCooldown = (userId: string, notificationType: string): boolean => {
  const cooldown = getMotivationalCooldown(userId, notificationType)
  if (!cooldown) return false
  
  const daysSince = (Date.now() - cooldown.dismissedAt) / (1000 * 60 * 60 * 24)
  return daysSince < cooldown.cooldownDays
}

// 🎯 CONFIGURACIÓN DE TIPOS DE NOTIFICACIONES CON ACCIONES
const NOTIFICATION_TYPES: NotificationTypesMap = {
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
  },
  // 🦊 AVATAR AUTOMÁTICO - Notificación de rotación semanal
  'avatar_rotation': {
    priority: 45,
    icon: '🦊',
    color: 'purple',
    bgColor: 'bg-purple-100 dark:bg-purple-900/50',
    textColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800',
    primaryAction: {
      label: '👀 Ver mi Avatar',
      type: 'view_avatar'
    }
  },

  // 🟢 MOTIVACIONALES (Prioridad 10-29) - SOLO DISMISSIBLE
  'constructive_progress': { 
    priority: 20, 
    icon: '🌱', 
    color: 'green',
    bgColor: 'bg-green-100 dark:bg-green-900/50',
    textColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
    // NO primaryAction ni secondaryAction - solo se puede cerrar con X o swipe
  }
}

// ✅ FUNCIÓN AUXILIAR: Validar y mapear law_short_name usando sistema centralizado
function validateAndMapLawShortName(lawShortName: string | null | undefined, lawFullName: string | null | undefined): string {
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
      ].filter((s): s is string => Boolean(s))

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

export function useIntelligentNotifications(): UseIntelligentNotificationsReturn {
  const { user, userProfile, supabase, loading: authLoading } = useAuth() as AuthContextValue
  
  // Estados principales
  const [allNotifications, setAllNotifications] = useState<Notification[]>([])
  const [testNotifications, setTestNotifications] = useState<Notification[]>(globalTestNotifications) // 🧪 Inicializar desde global
  const [loading, setLoading] = useState<boolean>(false) // Cambiar a false para permitir carga inicial
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [lastMotivationalCheck, setLastMotivationalCheck] = useState<number | null>(null)

  // Estados por categoría
  // const [disputeNotifications, setDisputeNotifications] = useState([]) // 🚫 ELIMINADO: ahora se maneja en useDisputeNotifications
  const [problematicArticles, setProblematicArticles] = useState<Notification[]>([])
  // const [studyStreaks, setStudyStreaks] = useState([]) // 🚫 ELIMINADO
  const [achievements, setAchievements] = useState<Notification[]>([])
  const [studyReminders, setStudyReminders] = useState<Notification[]>([])
  // const [progressUpdates, setProgressUpdates] = useState([]) // 🚫 ELIMINADO
  const [motivationalNotifications, setMotivationalNotifications] = useState<Notification[]>([])
  const [systemNotifications, setSystemNotifications] = useState<Notification[]>([])
  const [avatarRotationNotifications, setAvatarRotationNotifications] = useState<Notification[]>([])

  // 🆕 FUNCIÓN PARA GENERAR URLs DE ACCIÓN ESPECÍFICAS - CON SISTEMA CENTRALIZADO
  const generateActionUrl = (notification: Notification, actionType: string = 'primary'): string => {
    const baseParams = new URLSearchParams({
      utm_source: 'notification',
      utm_campaign: notification.campaign || 'general',
      notification_id: notification.id
    })
    
    try {
      switch (notification.type) {
        case 'problematic_articles':
          if (actionType === 'intensive_test') {
            // 🚀 SISTEMA UNIVERSAL: Usar /test/rapido con filtros (como level_regression)
            const articles = notification.articlesList?.map(a => a.article_number).join(',') || ''
            
            baseParams.append('articles', articles)
            baseParams.append('mode', 'intensive')
            baseParams.append('n', Math.min((notification.articlesCount ?? 1) * 2, 10).toString())

            // 🎯 Pasar short_name directo (evita roundtrip slug→short_name que puede fallar)
            if (notification.law_short_name) {
              baseParams.append('law_short_name', notification.law_short_name)
            }
            const lawSlug = generateLawSlug(notification.law_short_name ?? '')
            baseParams.append('law', lawSlug)
            
            // 💥 CACHE BUSTER: Forzar nuevo timestamp
            baseParams.append('_t', Date.now().toString())
            
            const finalUrl = `/test/rapido?${baseParams.toString()}`
            console.log(`🔗 URL generada para test de artículos problemáticos (UNIVERSAL):`)
            console.log(`   Ley: ${notification.law_short_name} → ${lawSlug}`)
            console.log(`   Artículos: ${articles}`)
            console.log(`   URL final: ${finalUrl}`)
            return finalUrl
          } else if (actionType === 'view_theory') {
            const lawSlug = generateLawSlug(notification.law_short_name ?? '')
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
            // 🔧 FIX CRÍTICO: Usar ruta correcta /test/rapido (no por ley específica)
            console.log('🚀 HOOK CORREGIDO - level_regression')
            baseParams.append('mode', 'recovery')
            baseParams.append('n', '15')

            // 🎯 Pasar short_name directo (evita roundtrip slug→short_name que puede fallar)
            if (notification.law_short_name) {
              baseParams.append('law_short_name', notification.law_short_name)
            }
            const lawSlug = generateLawSlug(notification.law_short_name ?? '')
            baseParams.append('law', lawSlug)

            // 💥 CACHE BUSTER: Forzar nuevo timestamp
            baseParams.append('_t', Date.now().toString())
            
            const finalUrl = `/test/rapido?${baseParams.toString()}`
            console.log('🔗 HOOK Generated level_regression URL (FIXED):', finalUrl)
            return finalUrl
          } else if (actionType === 'view_theory') {
            const lawSlug = generateLawSlug(notification.law_short_name ?? '')
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
          
        // case 'study_streak': // 🚫 ELIMINADO
          
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
          
        // case 'streak_broken': // 🚫 ELIMINADO
          
        // case 'progress_update': // 🚫 ELIMINADO
          
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
            return `/soporte?conversation_id=${notification.context_data?.conversation_id || notification.data?.conversation_id}`
          }
          break

        case 'avatar_rotation':
          if (actionType === 'view_avatar') {
            return `/perfil?${baseParams.toString()}`
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
  const executeAction = async (notification: Notification, actionType: 'primary' | 'secondary' = 'primary'): Promise<void> => {
    try {
      const notificationType = NOTIFICATION_TYPES[notification.type as keyof typeof NOTIFICATION_TYPES]
      if (!notificationType) return

      const action = actionType === 'primary' 
        ? notificationType.primaryAction 
        : notificationType.secondaryAction

      if (!action) return

      const actionUrl = generateActionUrl(notification, action.type)
      
      console.log(`🎯 Ejecutando acción: ${action.label} → ${actionUrl}`)
      
      // ✅ FIX: Marcar como leída ANTES de navegar si es acción primaria  
      if (actionType === 'primary') {
        saveDismissedNotification(notification.id)
        await markAsRead(notification.id)  // ✅ FIX: Marcar como leída permanentemente
        console.log(`✅ Notificación ${notification.id} marcada como leída por acción primaria`)
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
      const fallbackUrl = generateActionUrl(notification, 'default')
      window.location.href = fallbackUrl
    }
  }

  // 🧪 Setup global test notifications listener (solo desarrollo)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const handleGlobalTestNotificationsUpdate = (notifications: Notification[]) => {
        setTestNotifications(notifications)
      }

      addGlobalTestNotificationsListener(handleGlobalTestNotificationsUpdate)

      return () => {
        removeGlobalTestNotificationsListener(handleGlobalTestNotificationsUpdate)
      }
    }
    return undefined
  }, [])

  // Cargar todas las notificaciones cuando el usuario cambie
  useEffect(() => {
    // Esperar a que termine la autenticación
    if (authLoading) {
      return
    }

    // Esperar a que el perfil esté cargado (userProfile será null mientras carga)
    if (user && userProfile === null) {
      console.log('⏳ useIntelligentNotifications: Esperando perfil de usuario...')
      return
    }

    if (user && userProfile && supabase && !loading) {
      loadAllNotifications()
    } else if (!user) {
      resetNotifications()
    }
  }, [user, userProfile, authLoading, supabase])

  // Refrescar notificaciones cuando otra parte de la app marca algunas como leídas
  useEffect(() => {
    const handler = () => loadAllNotifications()
    window.addEventListener('notifications-updated', handler)
    return () => window.removeEventListener('notifications-updated', handler)
  }, [user, supabase])

  // Función auxiliar para filtrar notificaciones leídas (OPCIÓN B: desaparecen)
  const filterUnreadNotifications = (notifications: Notification[]) => {
    try {
      const readNotificationsKey = `read_notifications_${user?.id || 'anonymous'}`
      const readNotifications: Record<string, boolean> = JSON.parse(localStorage.getItem(readNotificationsKey) || '{}')

      // Filtrar: solo mostrar las que NO están marcadas como leídas
      return notifications.filter((notification: Notification) => {
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
        // loadDisputeNotifications(), // 🚫 ELIMINADO: ahora se maneja en useDisputeNotifications
        loadProblematicArticles(),
        // loadStudyStreaks(), // 🚫 ELIMINADO
        loadAchievements(),
        loadStudyReminders(),
        // loadProgressUpdates(), // 🚫 ELIMINADO
        loadSystemNotifications(),
        loadAvatarRotationNotifications() // 🦊 Avatar automático
      ])
      

      // 🆕 Si no hay notificaciones urgentes, cargar motivacionales
      const hasUrgentNotifications = [
        // ...disputeNotifications, // 🚫 ELIMINADO: ahora se maneja en useDisputeNotifications
        ...problematicArticles,
        // ...studyStreaks, // 🚫 ELIMINADO
        ...achievements,
        ...studyReminders,
        // ...progressUpdates, // 🚫 ELIMINADO
        ...systemNotifications,
        ...avatarRotationNotifications // 🦊 Avatar automático
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
  // 🚫 ELIMINADO: ahora se maneja en useDisputeNotifications
  /*
  const loadDisputeNotifications = async (): Promise<Notification[]> => {
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
        type: 'dispute_update' as const,
        title: dispute.status === 'resolved' ? '✅ Impugnación Aceptada' : '❌ Impugnación Rechazada',
        body: `Tu reporte sobre ${dispute.questions.articles.laws.short_name} Art. ${dispute.questions.articles.article_number} ha sido ${dispute.status === 'resolved' ? 'aceptado' : 'rechazado'}.`,
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

      return notifications

    } catch (error) {
      console.error('❌ Error cargando impugnaciones:', error)
      return []
    }
  }
  */

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
        // console.log(`📊 ${articles.length} artículos problemáticos encontrados`)
        
        // Agrupar artículos por ley CON VALIDACIÓN CENTRALIZADA
        interface LawGroup {
          law_short_name: string
          law_full_name: string
          articles: Array<{ article_number: string; accuracy_percentage: number; law_short_name: string; [key: string]: unknown }>
        }
        const articlesByLaw = articles.reduce<Record<string, LawGroup>>((acc, article) => {
          // 🎯 VALIDAR law_name con sistema centralizado (CORREGIDO: usar law_name, no law_short_name)
          const validatedShortName = validateAndMapLawShortName(
            article.law_name,  // ✅ CORRECTO: usar law_name (campo que existe)
            article.law_name   // ✅ CORRECTO: usar law_name como fallback
          )

          if (!acc[validatedShortName]) {
            // Intentar obtener nombre completo: 1) LAW_INFO, 2) article.law_name original, 3) validatedShortName
            const lawInfo = getLawInfo(validatedShortName)
            const fullName = lawInfo?.name ?? article.law_name ?? validatedShortName

            acc[validatedShortName] = {
              law_short_name: validatedShortName,
              law_full_name: fullName,
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
              // console.log(`🕒 Artículo ${finalShortName} Art.${article.article_number} filtrado por cooldown`)
            }
            
            return shouldShow
          })
          
          // Si no quedan artículos después del filtro de cooldown, no crear notificación
          if (articlesAfterCooldown.length === 0) {
            // console.log(`🚫 No se creará notificación para ${finalShortName}: todos los artículos están en cooldown`)
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
              body: articlesAfterCooldown.length === 1 
                ? `${finalShortName} Art. ${worstArticle.article_number}: ${worstArticle.accuracy_percentage}% de aciertos`
                : `${finalShortName} Arts. ${articleNumbers} con <70% accuracy. El peor: Art. ${worstArticle.article_number} (${worstArticle.accuracy_percentage}%)`,
              timestamp: new Date().toISOString(),
              isRead: false,
              isDismissed: false,
              
              // 🆕 DATOS ESPECÍFICOS CON SISTEMA CENTRALIZADO
              law_short_name: finalShortName,  // ✅ GARANTIZADO válido
              law_full_name: lawInfo?.name ?? law_full_name ?? finalShortName,  // ✅ Con fallbacks
              article: articlesAfterCooldown.length === 1 
                ? `${finalShortName} - Art. ${worstArticle.article_number}` 
                : `${finalShortName} - ${articlesAfterCooldown.length} artículos`,
              accuracy: worstArticle.accuracy_percentage,
              attempts: articlesAfterCooldown.reduce((sum, a) => sum + (Number(a.total_attempts) || 0), 0),
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

  // 3️⃣ CARGAR RACHAS CON ACCIONES ESPECÍFICAS - 🚫 ELIMINADO
  /*
  const loadStudyStreaks = async (): Promise<Notification[]> => {
    // Función comentada porque setStudyStreaks fue eliminado
    return []
  }
  */

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

      // 🚫 ELIMINADAS notificaciones de inactividad cuando el usuario está navegando
      // Si el usuario está activo en la web, no tiene sentido mostrar notificaciones
      // de "racha rota" o "te echamos de menos" - ya está aquí, interesado en estudiar
      console.log('🚫 Notificaciones de inactividad/racha rota eliminadas - el usuario está navegando activamente')
      

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

  // 6️⃣ CARGAR ACTUALIZACIONES DE PROGRESO CON ACCIONES - 🚫 ELIMINADO
  /*
  const loadProgressUpdates = async (): Promise<Notification[]> => {
    // Función comentada porque setProgressUpdates fue eliminado
    return []
  }
  */

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

      const systemNotifs = notifications?.map(notif => {
        // Extraer tipo de context_data si está disponible, sino usar type directo
        const notifType = notif.context_data?.type || notif.type
        
        // 🆕 MEJORAR NOTIFICACIONES DE FEEDBACK CON INFORMACIÓN ESPECÍFICA
        let title = notif.context_data?.title || notif.title || 'Notificación'
        let message = notif.message_sent || notif.message
        
        if (notifType === 'feedback_response') {
          // Extraer el preview del mensaje del admin desde message_sent
          const messageMatch = notif.message_sent?.match(/El equipo de Vence: "(.+)"/)
          const adminMessage = messageMatch ? messageMatch[1] : notif.message_sent
          
          title = '💬 Nueva respuesta de Vence'
          message = adminMessage || 'El equipo de Vence ha respondido a tu consulta'
        }
        
        return {
          id: `system-${notif.id}`,
          type: notifType,
          title: title,
          message: message,
          timestamp: notif.created_at,
          isRead: !!notif.opened_at,
          data: notif.context_data || notif.data,
          context_data: notif.context_data,
          priority: NOTIFICATION_TYPES[notifType]?.priority || 30,
          ...(NOTIFICATION_TYPES[notifType] || {
            icon: '💬',
            color: 'blue',
            bgColor: 'bg-blue-100 dark:bg-blue-900/50',
            textColor: 'text-blue-600 dark:text-blue-400',
            borderColor: 'border-blue-200 dark:border-blue-800'
          })
        }
      }).filter(notif => !dismissedNotifications.has(notif.id)) || []

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

  // 🦊 CARGAR NOTIFICACIONES DE ROTACIÓN DE AVATAR
  const loadAvatarRotationNotifications = async () => {
    try {
      if (!user?.id || !supabase) return []

      // Fetch avatar settings sin filtrar por rotation_notification_pending
      // para evitar 406 si la columna no existe en cache de PostgREST
      const { data: avatarSettings, error } = await supabase
        .from('user_avatar_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      // Verificar si hay notificación pendiente (en JS, no en query)
      if (error || !avatarSettings || !avatarSettings.rotation_notification_pending) {
        setAvatarRotationNotifications([])
        return []
      }

      // Obtener información del perfil actual
      const { data: profileData } = await supabase
        .from('avatar_profiles')
        .select('emoji, name_es, description_es')
        .eq('id', avatarSettings.current_profile)
        .single()

      if (!profileData) {
        setAvatarRotationNotifications([])
        return []
      }

      const notification = {
        id: `avatar-rotation-${avatarSettings.last_rotation_at}`,
        type: 'avatar_rotation',
        title: `${profileData.emoji} ¡Nuevo avatar esta semana!`,
        message: `Tu avatar automático ha cambiado. Esta semana eres: ${profileData.name_es}. ${profileData.description_es}`,
        timestamp: avatarSettings.last_rotation_at,
        isRead: false,
        avatarEmoji: profileData.emoji,
        avatarName: profileData.name_es,
        previousEmoji: avatarSettings.previous_emoji,
        priority: NOTIFICATION_TYPES.avatar_rotation.priority,
        ...NOTIFICATION_TYPES.avatar_rotation,
        // Usar el emoji del nuevo avatar como icono
        icon: profileData.emoji
      }

      console.log('🦊 Notificación de avatar cargada:', notification)
      setAvatarRotationNotifications([notification])
      return [notification]

    } catch (error) {
      console.error('❌ Error cargando notificación de avatar:', error)
      setAvatarRotationNotifications([])
      return []
    }
  }

  // Función para marcar notificación de avatar como leída
  const markAvatarNotificationAsRead = async () => {
    try {
      if (!user?.id || !supabase) return

      await supabase
        .from('user_avatar_settings')
        .update({ rotation_notification_pending: false })
        .eq('user_id', user.id)

      setAvatarRotationNotifications([])
      console.log('✅ Notificación de avatar marcada como leída')
    } catch (error) {
      console.error('❌ Error marcando notificación de avatar:', error)
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

      // 🆕 FILTRAR NOTIFICACIONES EN COOLDOWN (14 días)
      const motivationalNotifsWithoutCooldown = motivationalNotifs.filter(notification => {
        if (notification.type === 'study_consistency') {
          const inCooldown = isInMotivationalCooldown(user.id, 'study_consistency')
          console.log(`🔍 DEBUG: Verificando cooldown para "Patrón Óptimo":`, {
            notificationId: notification.id,
            type: notification.type,
            inCooldown,
            userId: user.id
          })
          if (inCooldown) {
            console.log(`⏰ Notificación "Patrón Óptimo" en cooldown - no mostrar`)
            return false
          }
        }
        return true
      })

      // Filtrar notificaciones leídas y descartadas
      const unreadMotivationalNotifs = filterUnreadNotifications(motivationalNotifsWithoutCooldown)

      // 🚫 DESACTIVADO: No enviar emails automáticamente - solo mostrar en campana
      // Las notificaciones motivacionales ahora son SOLO avisos en la interfaz
      console.log(`📢 ${unreadMotivationalNotifs.length} notificaciones motivacionales generadas (solo campana, sin emails)`)
      
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
    // setDisputeNotifications([]); // 🚫 ELIMINADO
    setProblematicArticles([]);
    // setStudyStreaks([]); // 🚫 ELIMINADO
    setAchievements([]);
    setStudyReminders([]);
    // setProgressUpdates([]); // 🚫 ELIMINADO
    setMotivationalNotifications([]);
    setSystemNotifications([]);
    setLoading(false);
  };

  // Combinar y ordenar todas las notificaciones por prioridad
  useEffect(() => {
    const combined = [
      // ...disputeNotifications, // 🚫 ELIMINADO: ahora se maneja en useDisputeNotifications
      ...problematicArticles,
      // ...studyStreaks, // 🚫 ELIMINADO
      ...achievements,
      ...studyReminders,
      // ...progressUpdates, // 🚫 ELIMINADO
      ...motivationalNotifications,
      ...systemNotifications,
      ...avatarRotationNotifications, // 🦊 Avatar automático
      ...testNotifications // 🧪 Incluir notificaciones de testing
    ].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    setAllNotifications(combined);
  }, [problematicArticles, achievements, studyReminders, motivationalNotifications, systemNotifications, avatarRotationNotifications, testNotifications]);

  // Calcular contadores
  const unreadCount = allNotifications.filter(n => !n.isRead).length;
  
  // 🧪 DEBUG: Solo log cuando hay cambios significativos
  if (process.env.NODE_ENV === 'development' && testNotifications.length > 0) {
    console.log('🧪 Hook state:', {
      allNotifications: allNotifications.length,
      testNotifications: testNotifications.length,
      unreadCount
    })
  }
  
  const categorizedNotifications = {
    critical: allNotifications.filter(n => n.priority >= 90),
    important: allNotifications.filter(n => n.priority >= 70 && n.priority < 90),
    recommendations: allNotifications.filter(n => n.priority >= 50 && n.priority < 70),
    info: allNotifications.filter(n => n.priority < 50)
  };

  // Función para marcar como leída (OPCIÓN B: desaparece de la campana)
  const markAsRead = async (notificationId: string): Promise<void> => {
    try {
      console.log('🗑️ Marcando como leída (desaparecerá):', notificationId)
      
      if (notificationId.startsWith('dispute-')) {
        // Para impugnaciones: marcar en BD
        // 🚫 NOTA: Las impugnaciones ahora se manejan en useDisputeNotifications
        const disputeId = notificationId.replace('dispute-', '');
        const { error } = await supabase
          .from('question_disputes')
          .update({ is_read: true })
          .eq('id', disputeId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Remover de la lista general de notificaciones
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
      else if (notificationId.startsWith('avatar-rotation-')) {
        // 🦊 Para notificaciones de avatar: marcar en BD
        await markAvatarNotificationAsRead();
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
        
        // ✅ Cooldowns de racha rota eliminados - ya no se usan estas notificaciones
        
        // Guardar en localStorage
        localStorage.setItem(readNotificationsKey, JSON.stringify(readNotifications))
        console.log('💾 Notificación marcada como leída y removida de UI:', notificationId)
        
        // 🧪 Manejar notificaciones de testing con estado global
        if (process.env.NODE_ENV === 'development') {
          const updatedTestNotifications = globalTestNotifications.filter(n => n.id !== notificationId)
          updateGlobalTestNotifications(updatedTestNotifications)
        }
        
        // Remover inmediatamente de todas las listas locales
        const notification = allNotifications.find(n => n.id === notificationId)
        if (notification) {
          switch (notification.type) {
            case 'problematic_articles':
              setProblematicArticles(prev => 
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
            case 'improvement':
              setAchievements(prev => 
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
            case 'constructive_progress': // 🧪 Incluir testing
              setMotivationalNotifications(prev =>
                prev.filter(n => n.id !== notificationId)
              );
              break;
            case 'avatar_rotation': // 🦊 Avatar automático
              setAvatarRotationNotifications(prev =>
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
  const dismissNotification = (notificationId: string): void => {
    console.log('🗑️ Descartando notificación:', notificationId);
    
    // 🆕 DETECTAR Y APLICAR COOLDOWN PARA NOTIFICACIONES MOTIVACIONALES
    if (user?.id && notificationId.includes('motivational-')) {
      console.log('🔍 DEBUG: Detectada notificación motivacional para cooldown:', {
        notificationId,
        userId: user.id,
        isConsistencyPattern: notificationId.includes('consistency-pattern')
      })
      
      // Extraer tipo de notificación del ID
      if (notificationId === 'motivational-consistency-pattern') {
        console.log('🔄 Activando cooldown para study_consistency...')
        setMotivationalCooldown(user.id, 'study_consistency')
      }
      // Aquí se pueden añadir más tipos motivacionales en el futuro
    } else {
      console.log('🔍 DEBUG: No es notificación motivacional o falta usuario:', {
        hasUser: !!user?.id,
        isMotivational: notificationId.includes('motivational-'),
        notificationId
      })
    }
    
    // ✅ NUEVO: Guardar en localStorage para persistencia
    saveDismissedNotification(notificationId)
    
    // 🧪 Manejar notificaciones de testing con estado global
    if (process.env.NODE_ENV === 'development') {
      const updatedTestNotifications = globalTestNotifications.filter(n => n.id !== notificationId)
      updateGlobalTestNotifications(updatedTestNotifications)
    }
    
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
    setAchievements(prev => prev.filter(n => n.id !== notificationId));
    setStudyReminders(prev => prev.filter(n => n.id !== notificationId));
    setMotivationalNotifications(prev => prev.filter(n => n.id !== notificationId));
    setSystemNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // 🆕 FUNCIÓN PARA OBTENER ACCIONES DE UNA NOTIFICACIÓN
  const getNotificationActions = (notification: Notification): { primary?: NotificationAction & { url: string }; secondary?: NotificationAction & { url: string } | null } => {
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
    // disputeNotifications, // 🚫 ELIMINADO: ahora se maneja en useDisputeNotifications
    problematicArticles,
    // studyStreaks, // 🚫 ELIMINADO
    achievements,
    studyReminders,
    // progressUpdates, // 🚫 ELIMINADO
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
    
    // 🧪 FUNCIONES DE TESTING (solo desarrollo)
    injectTestNotification: process.env.NODE_ENV === 'development' ? (notification: Partial<Notification>) => {
      // Agregar prioridad desde NOTIFICATION_TYPES si no existe
      const notificationWithPriority: Notification = {
        id: notification.id || `test-${Date.now()}`,
        type: notification.type || 'achievement',
        title: notification.title || 'Test',
        timestamp: notification.timestamp || new Date().toISOString(),
        isRead: notification.isRead ?? false,
        priority: notification.priority || (notification.type ? NOTIFICATION_TYPES[notification.type]?.priority : undefined) || 50,
        ...notification
      } as Notification

      const newNotifications = [notificationWithPriority, ...globalTestNotifications]
      updateGlobalTestNotifications(newNotifications)
      console.log('🧪 Test notification injected globally:', notificationWithPriority)
    } : undefined,
    
    clearAllNotifications: process.env.NODE_ENV === 'development' ? () => {
      updateGlobalTestNotifications([])
      console.log('🧹 All test notifications cleared globally')
    } : undefined,
    
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
    'view_dispute': '📋',
    'view_corrected_question': '✅',
    'view_details': '📋',
    'view_changelog': '🆕',
    'open_chat': '💬',
    'view_feedback': '📝'
  };
  
  return icons[actionType] || '👆';
};

