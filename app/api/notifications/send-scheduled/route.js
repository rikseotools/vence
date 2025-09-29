// API endpoint para envío programado de notificaciones push
// Sistema de oposiciones - ilovetest

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { UserPatternAnalyzer } from '../../../lib/notifications/userPatternAnalyzer'
import { selectContextualMessage, calculateMessageUrgency } from '../../../lib/notifications/oposicionMessages'

// Configurar web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// Cliente Supabase con permisos de servicio
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // Verificar autorización (solo para cron jobs o admin)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🚀 Iniciando envío programado de notificaciones...')

    // Obtener usuarios que necesitan notificación
    const { data: usersToNotify, error: usersError } = await supabase
      .from('users_needing_notifications')
      .select('*')

    if (usersError) {
      console.error('Error fetching users to notify:', usersError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!usersToNotify || usersToNotify.length === 0) {
      console.log('📭 No hay usuarios para notificar en este momento')
      return NextResponse.json({ 
        success: true, 
        message: 'No users to notify',
        processed: 0 
      })
    }

    console.log(`📢 Procesando ${usersToNotify.length} usuarios para notificación`)

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: []
    }

    // Procesar cada usuario
    for (const user of usersToNotify) {
      try {
        const success = await processUserNotification(user)
        if (success) {
          results.sent++
        } else {
          results.skipped++
        }
      } catch (error) {
        console.error(`Error processing user ${user.user_id}:`, error)
        results.failed++
        results.errors.push({
          userId: user.user_id,
          error: error.message
        })
      }
    }

    console.log(`✅ Proceso completado: ${results.sent} enviadas, ${results.failed} fallidas, ${results.skipped} omitidas`)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Error in scheduled notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Procesar notificación para un usuario específico
async function processUserNotification(user) {
  try {
    // Analizar patrones del usuario
    const analyzer = new UserPatternAnalyzer(user.user_id)
    const patterns = await analyzer.analyzeUserPatterns()

    // Determinar tipo de notificación necesaria
    const notificationType = determineNotificationType(user, patterns)
    
    if (notificationType === 'skip') {
      console.log(`⏭️ Omitiendo notificación para usuario ${user.user_id}`)
      return false
    }

    // Generar mensaje contextual
    const messageContext = buildMessageContext(user, patterns)
    const message = selectContextualMessage(notificationType, messageContext)
    const urgency = calculateMessageUrgency(messageContext)

    // Crear payload de notificación
    const notificationPayload = {
      title: getNotificationTitle(notificationType, messageContext),
      body: message,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `${notificationType}-${Date.now()}`,
      data: {
        url: getTargetUrl(notificationType),
        category: notificationType,
        urgency: urgency,
        userId: user.user_id,
        timestamp: Date.now(),
        context: messageContext
      },
      actions: getNotificationActions(notificationType),
      requireInteraction: urgency >= 4
    }

    // Enviar notificación push
    const pushSubscription = JSON.parse(user.push_subscription)
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(notificationPayload),
      {
        urgency: urgency >= 4 ? 'high' : 'normal',
        TTL: 24 * 60 * 60 // 24 horas
      }
    )

    // Registrar en logs
    await logNotification(user.user_id, notificationType, message, notificationPayload)

    // Actualizar próxima notificación
    await updateNextNotificationTime(user.user_id, patterns)

    console.log(`✅ Notificación enviada a usuario ${user.user_id}: ${notificationType}`)
    return true

  } catch (error) {
    console.error(`❌ Error procesando usuario ${user.user_id}:`, error)
    
    // Si es error de suscripción inválida, desactivar notificaciones
    if (error.statusCode === 410) {
      await disableUserNotifications(user.user_id)
      console.log(`🔕 Desactivadas notificaciones para usuario ${user.user_id} (suscripción inválida)`)
    }
    
    throw error
  }
}

// Determinar qué tipo de notificación enviar
function determineNotificationType(user, patterns) {
  const hoursSinceLastSession = user.hours_since_last_session || 0
  const riskLevel = user.risk_level || 'low'
  const currentStreak = user.streak_status || 0

  // Verificar si es demasiado pronto para notificar
  if (hoursSinceLastSession < 12) {
    return 'skip'
  }

  // Casos de emergencia
  if (riskLevel === 'critical' || hoursSinceLastSession >= 168) { // 7 días
    return 'emergency_motivation'
  }

  // Peligro de racha
  if (currentStreak >= 5 && hoursSinceLastSession >= 24) {
    return 'streak_danger'
  }

  // Regreso después de inactividad
  if (hoursSinceLastSession >= 48) {
    return 'comeback'
  }

  // Logros y celebraciones
  if (currentStreak > 0 && currentStreak % 7 === 0 && hoursSinceLastSession < 24) {
    return 'achievement'
  }

  // Motivación diaria estándar
  return 'daily_motivation'
}

// Construir contexto para el mensaje
function buildMessageContext(user, patterns) {
  const now = new Date()
  const hour = now.getHours()
  
  let timeOfDay = 'morning'
  if (hour >= 12 && hour < 18) timeOfDay = 'afternoon'
  else if (hour >= 18) timeOfDay = 'evening'
  else if (hour >= 22 || hour < 6) timeOfDay = 'night'

  return {
    streak: user.streak_status || 0,
    daysInactive: Math.floor(user.hours_since_last_session / 24) || 0,
    score: patterns.performancePatterns?.accuracy || 0,
    totalQuestions: patterns.performancePatterns?.totalAnswers || 0,
    weakTopic: patterns.performancePatterns?.weakAreas?.[0] || '',
    strongTopic: patterns.performancePatterns?.strongAreas?.[0] || '',
    daysUntilExam: calculateDaysUntilExam(user.exam_date),
    motivationLevel: user.motivation_level || 'medium',
    timeOfDay,
    dayOfWeek: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()],
    riskLevel: user.risk_level || 'low'
  }
}

// Calcular días hasta el examen
function calculateDaysUntilExam(examDate) {
  if (!examDate) return null
  
  const now = new Date()
  const exam = new Date(examDate)
  const diffTime = exam - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays > 0 ? diffDays : null
}

// Obtener título de notificación
function getNotificationTitle(type, context) {
  const titles = {
    streak_danger: `🚨 ¡Tu racha de ${context.streak} días en peligro!`,
    daily_motivation: '🎯 ilovetest - Tu oposición te espera',
    comeback: `🔄 ¡Te echábamos de menos!`,
    achievement: `🏆 ¡${context.streak} días consecutivos!`,
    emergency_motivation: '🆘 ¡Tu oposición necesita atención!',
    exam_proximity: `⏰ ${context.daysUntilExam} días para tu examen`
  }

  return titles[type] || '📚 ilovetest - Hora de estudiar'
}

// Obtener URL objetivo según el tipo
function getTargetUrl(type) {
  const urls = {
    streak_danger: '/test/rapido?from=streak_danger',
    daily_motivation: '/test/aleatorio?from=daily_motivation',
    comeback: '/es?from=comeback',
    achievement: '/mis-estadisticas?from=achievement',
    emergency_motivation: '/test/rapido?from=emergency',
    exam_proximity: '/test/aleatorio?from=exam_prep'
  }

  return urls[type] || '/es?from=notification'
}

// Obtener acciones de notificación
function getNotificationActions(type) {
  const actions = {
    streak_danger: [
      { action: 'study_urgent', title: '🚨 ¡Salvar Racha!', icon: '/icon-urgent.png' },
      { action: 'dismiss', title: '❌ Ignorar', icon: '/icon-dismiss.png' }
    ],
    achievement: [
      { action: 'continue', title: '🔥 ¡Continuar!', icon: '/icon-continue.png' },
      { action: 'share', title: '📱 Compartir', icon: '/icon-share.png' }
    ],
    default: [
      { action: 'study', title: '🎯 Estudiar', icon: '/icon-study.png' },
      { action: 'later', title: '⏰ Más Tarde', icon: '/icon-later.png' }
    ]
  }

  return actions[type] || actions.default
}

// Registrar notificación en logs
async function logNotification(userId, type, message, payload) {
  try {
    await supabase
      .from('notification_logs')
      .insert({
        user_id: userId,
        message_sent: message,
        delivery_status: 'sent',
        context_data: {
          type,
          payload: payload.data,
          urgency: payload.data?.urgency
        },
        sent_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Error logging notification:', error)
  }
}

// Actualizar próxima hora de notificación
async function updateNextNotificationTime(userId, patterns) {
  try {
    const riskLevel = patterns.riskAssessment?.level || 'low'
    const motivationType = patterns.motivationProfile?.type || 'balanced'
    
    // Calcular próxima notificación basada en riesgo y tipo
    let hoursUntilNext = 24 // Por defecto 24 horas
    
    if (riskLevel === 'critical') hoursUntilNext = 12
    else if (riskLevel === 'high') hoursUntilNext = 16
    else if (riskLevel === 'medium') hoursUntilNext = 20
    
    if (motivationType === 'needs_support') hoursUntilNext -= 4
    else if (motivationType === 'high_achiever') hoursUntilNext += 8

    const nextNotificationTime = new Date(Date.now() + hoursUntilNext * 60 * 60 * 1000)

    await supabase
      .from('user_smart_scheduling')
      .update({
        next_notification_time: nextNotificationTime.toISOString(),
        last_session_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

  } catch (error) {
    console.error('Error updating next notification time:', error)
  }
}

// Desactivar notificaciones para usuario
async function disableUserNotifications(userId) {
  try {
    await supabase
      .from('user_notification_settings')
      .update({
        push_enabled: false,
        push_subscription: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
  } catch (error) {
    console.error('Error disabling user notifications:', error)
  }
}

// Endpoint GET para verificar estado del sistema
export async function GET() {
  try {
    // Verificar configuración
    const hasVapidKeys = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    
    // Contar usuarios con notificaciones habilitadas
    const { count: enabledUsers } = await supabase
      .from('user_notification_settings')
      .select('*', { count: 'exact', head: true })
      .eq('push_enabled', true)

    // Contar usuarios que necesitan notificación
    const { count: pendingNotifications } = await supabase
      .from('users_needing_notifications')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      status: 'ok',
      configuration: {
        vapid_configured: hasVapidKeys,
        supabase_connected: true
      },
      stats: {
        users_with_notifications: enabledUsers || 0,
        pending_notifications: pendingNotifications || 0
      }
    })

  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500 }
    )
  }
}