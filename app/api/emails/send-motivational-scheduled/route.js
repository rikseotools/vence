// app/api/emails/send-motivational-scheduled/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkAndNotifyNewMedals } from '@/lib/services/rankingMedals'
import { generateUnsubscribeUrl } from '../../email-unsubscribe/route.js'

// 🎨 TEMPLATES VARIABLES: Evitar emails repetitivos
const EMAIL_TEMPLATES = {
  comeback: {
    subjects: [
      '¡Te echamos de menos! Continúa con tu preparación 💪',
      '¡Hora de retomar el ritmo! 📚',
      '¿Continuamos donde lo dejamos? 🚀',
      'Tu progreso te está esperando ⭐',
      '¡Es momento de brillar! 🎯'
    ],
    titles: [
      '¡Vuelve a la preparación!',
      '¡Retoma tu rutina de estudio!',
      '¡Tu futuro te necesita!',
      '¡No pares ahora!',
      '¡Sigue hacia tu meta!'
    ],
    bodies: [
      'Han pasado {days} días desde tu última sesión. ¡No pierdas el ritmo de estudio!',
      'Te echamos de menos. Han sido {days} días sin verte por aquí.',
      '¡Tu constancia es clave! Lleva {days} días sin estudiar.',
      'El tiempo vuela... ya son {days} días. ¡Vuelve a la acción!',
      'Tu disciplina marca la diferencia. ¡Retoma después de {days} días!'
    ]
  },
  streak_risk: {
    subjects: [
      '🔥 ¡No pierdas tu racha de {streak} días!',
      '⚡ ¡Protege tu racha de {streak} días!',
      '🎯 ¡Mantén tu streak de {streak} días!',
      '💪 ¡{streak} días de constancia en riesgo!',
      '🚀 ¡Tu racha de {streak} días te necesita!'
    ],
    titles: [
      '¡Protege tu racha!',
      '¡Mantén la constancia!',
      '¡No rompas el ritmo!',
      '¡Sigue la serie!',
      '¡Defiende tu progreso!'
    ],
    bodies: [
      'Llevas {streak} días de constancia. ¡No dejes que se rompa ahora!',
      '¡Increíble! {streak} días seguidos. ¿Seguimos?',
      'Tu racha de {streak} días es impresionante. ¡Mantenla viva!',
      '{streak} días de disciplina no pueden perderse. ¡Continúa!',
      'Has conseguido {streak} días consecutivos. ¡Un día más!'
    ]
  },
  achievement: {
    subjects: [
      '🎉 ¡Increíble! {score}% de media',
      '⭐ ¡Excelente rendimiento! {score}%',
      '🏆 ¡Vas genial con {score}%!',
      '🎯 ¡{score}% de aciertos! ¡Fantástico!',
      '🌟 ¡Brillante! {score}% de promedio'
    ],
    titles: [
      '¡Vas muy bien!',
      '¡Excelente progreso!',
      '¡Rendimiento superior!',
      '¡Estás en racha!',
      '¡Sigue así!'
    ],
    bodies: [
      'Tu rendimiento promedio es del {score}%. ¡Sigue así y conseguirás tus objetivos!',
      '¡Impresionante! Un {score}% de media demuestra tu dedicación.',
      'Con un {score}% de aciertos, vas por el camino correcto.',
      '¡Felicidades! Tu {score}% de promedio es excepcional.',
      'Un {score}% de rendimiento habla de tu esfuerzo. ¡Continúa!'
    ]
  }
}

// 🎲 Función para obtener template aleatorio
function getRandomTemplate(messageType, data = {}) {
  const templates = EMAIL_TEMPLATES[messageType]
  if (!templates) return null
  
  const randomIndex = Math.floor(Math.random() * templates.subjects.length)
  
  return {
    subject: templates.subjects[randomIndex].replace(/\{(\w+)\}/g, (match, key) => data[key] || match),
    title: templates.titles[randomIndex],
    body: templates.bodies[randomIndex].replace(/\{(\w+)\}/g, (match, key) => data[key] || match)
  }
}

// 🛡️ LÍMITES ABSOLUTOS: Verificar si usuario ha recibido demasiados emails
async function checkEmailLimits(supabase, userId) {
  const now = Date.now()
  
  // Límite semanal: máximo 1 email motivacional por semana
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: weeklyEmails } = await supabase
    .from('email_events')
    .select('id')
    .eq('user_id', userId)
    .eq('email_type', 'motivation')
    .gte('created_at', weekAgo)
    .limit(1)
  
  if (weeklyEmails && weeklyEmails.length > 0) {
    return { 
      blocked: true, 
      reason: 'Límite semanal alcanzado (1 email motivacional por semana)' 
    }
  }
  
  // Límite mensual: máximo 3 emails de cualquier tipo por mes
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: monthlyEmails } = await supabase
    .from('email_events')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', monthAgo)
    .limit(4) // Buscar 4 para saber si hay más de 3
  
  if (monthlyEmails && monthlyEmails.length >= 3) {
    return { 
      blocked: true, 
      reason: `Límite mensual alcanzado (${monthlyEmails.length}/3 emails este mes)` 
    }
  }
  
  return { blocked: false }
}

const resend = new Resend(process.env.RESEND_API_KEY)

// Cliente Supabase con permisos de servicio
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Debug environment variables (only log existence, not values)
console.log('🔐 Environment check:', {
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasResendKey: !!process.env.RESEND_API_KEY,
  hasCronSecret: !!process.env.CRON_SECRET
})

export async function POST(request) {
  try {
    // 🚫 DESACTIVADO PERMANENTEMENTE: Sistema de emails motivacionales deshabilitado
    // Las notificaciones motivacionales ahora SOLO aparecen en la campana de la interfaz
    console.log('🚫 Endpoint de emails motivacionales DESACTIVADO - sin emails automáticos')
    return NextResponse.json({
      success: true,
      disabled: true,
      message: '🚫 Sistema de emails motivacionales desactivado. Solo notificaciones en campana.',
      results: { usersAnalyzed: 0, emailsSent: 0, errors: [], notifications: [] }
    })

    // 🚨 CÓDIGO ANTIGUO DESACTIVADO - TODO EL RESTO DEL ENDPOINT INACCESIBLE
    /*
    // 🚨 PAUSA TEMPORAL: Evitar spam mientras solucionamos
    if (process.env.PAUSE_MOTIVATIONAL_EMAILS === 'true') {
      console.log('⏸️ Emails motivacionales pausados temporalmente')
      return NextResponse.json({
        success: true,
        message: 'Emails motivacionales pausados por mantenimiento',
        results: { usersAnalyzed: 0, emailsSent: 0, errors: [], notifications: [] }
      })
    }

    // Verificar autorización del cron job
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Unauthorized cron job attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🚀 Iniciando análisis de emails motivacionales programados...')
    console.log('🔍 Testing database connection...')

    // Test database connection first
    const { data: testData, error: testError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)

    if (testError) {
      console.error('❌ Database connection test failed:', testError)
      return NextResponse.json({ 
        error: 'Database connection failed', 
        details: testError.message,
        code: testError.code 
      }, { status: 500 })
    }

    console.log('✅ Database connection OK')

    // 1. Obtener tests activos de los últimos 30 días
    const { data: sessions, error: sessionsError } = await supabase
      .from('tests')
      .select('user_id, created_at, score')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .eq('is_completed', true)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.error('❌ Error obteniendo sesiones:', sessionsError)
      console.error('📋 Detalles del error:', JSON.stringify(sessionsError, null, 2))
      return NextResponse.json({ 
        error: 'Database error', 
        details: sessionsError.message,
        code: sessionsError.code 
      }, { status: 500 })
    }

    if (!sessions || sessions.length === 0) {
      console.log('📭 No hay sesiones recientes para analizar')
      return NextResponse.json({ 
        success: true, 
        message: 'No recent sessions found',
        results: { usersAnalyzed: 0, emailsSent: 0, errors: [], notifications: [] }
      })
    }

    // 2. Obtener usuarios únicos
    const uniqueUserIds = [...new Set(sessions.map(s => s.user_id))]
    
    // 3. Obtener información de usuarios
    const { data: userProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .in('id', uniqueUserIds)

    if (profilesError) {
      console.error('❌ Error obteniendo perfiles:', profilesError)
      console.error('📋 Detalles del error:', JSON.stringify(profilesError, null, 2))
      return NextResponse.json({ 
        error: 'Database error', 
        details: profilesError.message,
        code: profilesError.code 
      }, { status: 500 })
    }

    // 4. Crear mapa de usuarios con sus perfiles
    const profileMap = new Map()
    userProfiles.forEach(profile => {
      profileMap.set(profile.id, profile)
    })

    // 5. Agrupar sesiones por usuario para análisis
    const userMap = new Map()
    sessions.forEach(session => {
      const userId = session.user_id
      const profile = profileMap.get(userId)
      
      if (!profile) return // Skip if no profile found
      
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          email: profile.email,
          name: profile.full_name,
          sessions: []
        })
      }
      userMap.get(userId).sessions.push(session)
    })

    console.log(`📊 Analizando ${userMap.size} usuarios activos...`)
    
    // 🏆 NUEVO: Verificar medallas solo los lunes para medallas semanales
    const now = new Date()
    const isMonday = now.getDay() === 1
    
    console.log(`📅 Hoy es ${now.toLocaleDateString()}, es lunes: ${isMonday}`)
    
    let totalMedalsAwarded = 0
    const medalAwards = []
    
    if (isMonday) {
      console.log('🏆 Es lunes - verificando medallas semanales para todos los usuarios...')
    } else {
      console.log('📧 No es lunes - solo procesando emails motivacionales')
    }

    const results = {
      usersAnalyzed: userMap.size,
      emailsSent: 0,
      medalsAwarded: 0,
      medalAwards: [],
      errors: [],
      notifications: []
    }

    // 2. PRIMERO: Verificar medallas SOLO LOS LUNES
    const usersWithMedals = new Set() // Usuarios que recibieron medallas
    
    if (isMonday) {
      for (const [userId, userData] of userMap) {
        try {
          console.log(`🏆 Verificando medallas semanales para ${userData.email}...`)
          const newMedals = await checkAndNotifyNewMedals(supabase, userId)
          
          if (newMedals.length > 0) {
            console.log(`🎉 ${newMedals.length} nueva(s) medalla(s) semanal(es) para ${userData.email}`)
            totalMedalsAwarded += newMedals.length
            usersWithMedals.add(userId) // Marcar usuario como que recibió medalla
            
            medalAwards.push({
              userId,
              email: userData.email,
              name: userData.name,
              medals: newMedals.map(m => ({ type: m.id, title: m.title, period: m.period }))
            })
          }
        } catch (error) {
          console.error(`❌ Error verificando medallas para ${userId}:`, error)
        }
      }
    } else {
      console.log('📧 Saltando verificación de medallas (solo los lunes)')
    }

    results.medalsAwarded = totalMedalsAwarded
    results.medalAwards = medalAwards
    console.log(`🏆 Total medallas otorgadas: ${totalMedalsAwarded}`)

    // 3. SEGUNDO: Analizar cada usuario y enviar emails motivacionales si es necesario
    let emailCount = 0
    for (const [userId, userData] of userMap) {
      try {
        // PRIORIZAR MEDALLAS: Si ya recibió medalla, saltarlo
        if (usersWithMedals.has(userId)) {
          console.log(`🏆 ${userData.email} ya recibió email de medalla - saltando email motivacional`)
          continue
        }
        
        const analysis = await analyzeUserForMotivationalEmail(userData, supabase)
        
        if (analysis.shouldSendEmail) {
          console.log(`📧 Enviando email a ${userData.email}: ${analysis.reason}`)
          
          // Rate limit: máximo 2 emails/segundo en Resend
          if (emailCount > 0 && emailCount % 2 === 0) {
            console.log('⏸️ Pausa de 1 segundo para respetar rate limit de Resend...')
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          
          const emailResult = await sendMotivationalEmail(userData, analysis, supabase)
          emailCount++
          
          if (emailResult.success) {
            results.emailsSent++
            results.notifications.push({
              userId,
              email: userData.email,
              type: analysis.messageType,
              reason: analysis.reason
            })
          } else {
            results.errors.push({
              userId,
              email: userData.email,
              error: emailResult.error
            })
          }
        }
      } catch (error) {
        console.error(`❌ Error procesando usuario ${userId}:`, error)
        results.errors.push({
          userId,
          email: userData.email,
          error: error.message
        })
      }
    }

    console.log(`✅ Proceso completado: ${results.emailsSent} emails enviados, ${results.medalsAwarded} medallas otorgadas`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    })

  } catch (error) {
    console.error('❌ Error en proceso de emails motivacionales:', error)
    console.error('📋 Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack,
        name: error.name
      },
      { status: 500 }
    )
  }
}

// Función para analizar si un usuario necesita email motivacional
async function analyzeUserForMotivationalEmail(userData, supabase) {
  const { sessions, userId } = userData
  const now = new Date()
  
  // 🛡️ VERIFICAR LÍMITES ABSOLUTOS PRIMERO
  const limitsCheck = await checkEmailLimits(supabase, userId)
  if (limitsCheck.blocked) {
    return { shouldSendEmail: false, reason: limitsCheck.reason }
  }
  
  // 🎯 SEGMENTACIÓN INTELIGENTE: Solo usuarios comprometidos
  // Requiere actividad mínima para enviar emails
  if (sessions.length < 5) {
    return { 
      shouldSendEmail: false, 
      reason: `Usuario nuevo con poca actividad (${sessions.length} tests)` 
    }
  }
  
  // 🎯 SEGMENTACIÓN POR ACTIVIDAD REAL: Verificar calidad de usuario
  // Solo enviar a usuarios que han mostrado progreso reciente
  const recentGoodSessions = sessions.slice(0, 3).filter(s => s.score >= 50)
  if (recentGoodSessions.length === 0) {
    return { 
      shouldSendEmail: false, 
      reason: 'Usuario sin progreso positivo reciente (todas las sesiones < 50%)' 
    }
  }
  
  // Evitar usuarios que podrían estar "abandonando" (muchos tests pero puntajes bajos)
  const totalSessions = sessions.length
  const lowScoreSessions = sessions.filter(s => s.score < 40).length
  const lowScoreRatio = lowScoreSessions / totalSessions
  
  if (totalSessions >= 10 && lowScoreRatio > 0.7) {
    return { 
      shouldSendEmail: false, 
      reason: `Usuario con bajo rendimiento histórico (${Math.round(lowScoreRatio * 100)}% sesiones < 40%)` 
    }
  }
  
  // Calcular últimas actividades
  const lastSession = sessions[0]
  const lastSessionTime = new Date(lastSession.created_at)
  const hoursSinceLastSession = (now - lastSessionTime) / (1000 * 60 * 60)
  const daysSinceLastSession = hoursSinceLastSession / 24

  // Verificar preferencias de email del usuario
  const { data: emailPreferences } = await supabase
    .from('email_preferences')
    .select('unsubscribed_all, email_reactivacion')
    .eq('user_id', userId)
    .single()

  if (emailPreferences?.unsubscribed_all === true) {
    return { shouldSendEmail: false, reason: 'Usuario desactivó todos los emails' }
  }

  if (emailPreferences?.email_reactivacion === false) {
    return { shouldSendEmail: false, reason: 'Usuario desactivó emails de reactivación' }
  }

  // 🔧 FIX CRÍTICO: Verificar emails recientes en tabla correcta con cooldown de 7 días
  const { data: recentEmails } = await supabase
    .from('email_events')
    .select('created_at')
    .eq('user_id', userId)
    .eq('email_type', 'motivation')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // 7 días en lugar de 24h
    .limit(1)

  if (recentEmails && recentEmails.length > 0) {
    const lastEmailDate = new Date(recentEmails[0].created_at)
    const daysSinceLastEmail = (Date.now() - lastEmailDate.getTime()) / (1000 * 60 * 60 * 24)
    return { 
      shouldSendEmail: false, 
      reason: `Email ya enviado hace ${Math.round(daysSinceLastEmail)} días (cooldown: 7 días)` 
    }
  }

  // 🔧 UNIFICACIÓN: Verificar TODOS los tipos de emails en ambas tablas
  // Verificar en email_logs (sistema viejo de emailService.server.js)
  const { data: emailLogsCheck } = await supabase
    .from('email_logs')
    .select('sent_at, email_type')
    .eq('user_id', userId)
    .in('email_type', ['motivation', 'reactivacion', 'urgente', 'bienvenida_motivacional'])
    .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(1)

  if (emailLogsCheck && emailLogsCheck.length > 0) {
    return { 
      shouldSendEmail: false, 
      reason: `Email ${emailLogsCheck[0].email_type} ya enviado (sistema unificado)` 
    }
  }

  // 🔧 CRITERIO CONSERVADOR: Usuario inactivo por 7-21 días (antes era 2-7)
  if (daysSinceLastSession >= 7 && daysSinceLastSession <= 21) {
    const template = getRandomTemplate('comeback', { 
      days: Math.floor(daysSinceLastSession) 
    })
    
    return {
      shouldSendEmail: true,
      messageType: 'comeback',
      reason: `Inactivo por ${Math.floor(daysSinceLastSession)} días (criterio conservador)`,
      subject: template.subject,
      title: template.title,
      body: template.body
    }
  }

  // 🔧 CRITERIO CONSERVADOR: Racha en riesgo solo después de 3 días (antes era 1 día)
  if (daysSinceLastSession >= 3 && daysSinceLastSession < 7) {
    // Calcular racha actual
    let currentStreak = 0
    const dates = sessions.map(s => new Date(s.created_at).toDateString())
    const uniqueDates = [...new Set(dates)].sort().reverse()
    
    if (uniqueDates.length > 1) {
      currentStreak = uniqueDates.length
      
      if (currentStreak >= 3) {
        const template = getRandomTemplate('streak_risk', { 
          streak: currentStreak 
        })
        
        return {
          shouldSendEmail: true,
          messageType: 'streak_risk',
          reason: `Racha de ${currentStreak} días en riesgo`,
          subject: template.subject,
          title: template.title,
          body: template.body
        }
      }
    }
  }

  // 3. Logro de rendimiento (buen promedio reciente)
  const recentSessions = sessions.slice(0, 5)
  if (recentSessions.length >= 3) {
    const avgScore = recentSessions.reduce((sum, s) => sum + (s.score || 0), 0) / recentSessions.length
    
    // 🔧 CRITERIO CONSERVADOR: Solo felicitar si lleva 7+ días sin estudiar (antes era 1 día)
    if (avgScore >= 85 && daysSinceLastSession >= 7) {
      const template = getRandomTemplate('achievement', { 
        score: avgScore.toFixed(1) 
      })
      
      return {
        shouldSendEmail: true,
        messageType: 'achievement',
        reason: `Excelente rendimiento: ${avgScore.toFixed(1)}%`,
        subject: template.subject,
        title: template.title,
        body: template.body
      }
    }
  }

  return { shouldSendEmail: false, reason: 'No cumple criterios para email' }
}

// Función para enviar email motivacional
async function sendMotivationalEmail(userData, analysis, supabase) {
  try {
    const { email, name, userId } = userData
    
    // Generar ID temporal para tracking
    const temporaryEmailId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Generar HTML del email con tracking
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${analysis.subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px 20px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${analysis.title}</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Vence - Auxiliar Administrativo</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 16px; margin-bottom: 20px;">¡Hola${name ? ` ${name}` : ''}! 👋</p>
              
              <p style="font-size: 16px; margin-bottom: 25px;">${analysis.body}</p>
              
              <!-- CTA Button con tracking -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="https://vence.es/api/email-tracking/click?email_id=${temporaryEmailId}&user_id=${userId}&action=main_cta&type=motivation&redirect=${encodeURIComponent('https://www.vence.es/auxiliar-administrativo-estado/test?utm_source=email&utm_campaign=motivational')}" 
                   style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  🎯 Hacer Test Ahora
                </a>
              </div>
              
              <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                  💡 <strong>Recuerda:</strong> La constancia es clave para aprobar las oposiciones. ¡Cada minuto de estudio cuenta!
                </p>
              </div>
            </div>
            
            <!-- Footer con unsubscribe -->
            <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                <a href="https://www.vence.es/perfil" style="color: #667eea; text-decoration: none;">Gestionar preferencias</a>
                •
                <a href="${generateUnsubscribeUrl(email)}" style="color: #ef4444; text-decoration: none;">Cancelar suscripción</a>
              </p>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">
                © 2025 Vence. Te ayudamos a conseguir tu plaza.
              </p>
            </div>
          </div>
          
          <!-- Pixel de tracking para apertura -->
          <img src="https://vence.es/api/email-tracking/open?email_id=${temporaryEmailId}&user_id=${userId}&type=motivation" 
               width="1" height="1" style="display: none;" alt="">
        </body>
      </html>
    `

    // Enviar email con Resend
    const { data, error } = await resend.emails.send({
      from: 'Vence <noticias@vence.es>',
      to: [email],
      subject: analysis.subject,
      html: htmlContent,
    })

    if (error) {
      console.error('❌ Error enviando email:', error)
      return { success: false, error: error.message }
    }

    // Guardar evento en base de datos para tracking
    const { error: insertError } = await supabase.from('email_events').insert({
      user_id: userId,
      email_type: 'motivation',
      event_type: 'sent',
      email_address: email,
      subject: analysis.subject,
      template_id: analysis.messageType,
      email_content_preview: analysis.body.substring(0, 200)
    })

    if (insertError) {
      console.error('❌ Error guardando evento en email_events:', insertError)
      return { success: false, error: `Failed to log email: ${insertError.message}` }
    } else {
      console.log('✅ Evento guardado en email_events')
    }

    console.log(`✅ Email enviado exitosamente a ${email}`)
    return { success: true, emailId: data?.id }

  } catch (error) {
    console.error('❌ Error en sendMotivationalEmail:', error)
    return { success: false, error: error.message }
  }
}
*/
  } catch (error) {
    console.error('❌ Error en endpoint desactivado:', error)
    return NextResponse.json({
      success: true,
      disabled: true,
      message: '🚫 Endpoint desactivado',
      error: error.message
    })
  }
}