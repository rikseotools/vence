import 'server-only'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { emailTemplates, getEmailTypeName } from './templates'

// Inicialización lazy de servicios solo en servidor
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está configurada')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables de entorno de Supabase no configuradas')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// 🆕 FUNCIÓN PARA OBTENER PREFERENCIAS DE EMAIL
export async function getEmailPreferences(userId) {
  try {
    console.log(`🔍 Verificando preferencias de email para usuario ${userId}`)
    
    const supabase = getSupabase()
    const { data: preferences, error } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // No existe, crear con valores por defecto (todos activados)
      console.log('📝 Creando preferencias por defecto para usuario nuevo')
      
      const { data: newPrefs, error: createError } = await supabase
        .from('email_preferences')
        .insert({
          user_id: userId,
          email_reactivacion: true,
          email_urgente: true,
          email_bienvenida_motivacional: true,
          email_bienvenida_inmediato: true,
          unsubscribed_all: false
        })
        .select()
        .single()
      
      if (createError) {
        console.error('❌ Error creando preferencias por defecto:', createError)
        // Fallback: permitir emails por defecto
        return {
          email_reactivacion: true,
          email_urgente: true,
          email_bienvenida_motivacional: true,
          email_bienvenida_inmediato: true,
          unsubscribed_all: false
        }
      }
      
      return {
        email_reactivacion: newPrefs.email_reactivacion,
        email_urgente: newPrefs.email_urgente,
        email_bienvenida_motivacional: newPrefs.email_bienvenida_motivacional,
        email_bienvenida_inmediato: newPrefs.email_bienvenida_inmediato || true,
        unsubscribed_all: newPrefs.unsubscribed_all
      }
    } else if (error) {
      console.error('❌ Error obteniendo preferencias de email:', error)
      // Fallback: no enviar emails si hay error
      return {
        email_reactivacion: false,
        email_urgente: false,
        email_bienvenida_motivacional: false,
        email_bienvenida_inmediato: false,
        unsubscribed_all: true
      }
    }
    
    console.log(`✅ Preferencias obtenidas:`, {
      reactivacion: preferences.email_reactivacion,
      urgente: preferences.email_urgente,
      motivacional: preferences.email_bienvenida_motivacional,
      inmediato: preferences.email_bienvenida_inmediato,
      unsubscribed_all: preferences.unsubscribed_all
    })
    
    return {
      email_reactivacion: preferences.email_reactivacion,
      email_urgente: preferences.email_urgente,
      email_bienvenida_motivacional: preferences.email_bienvenida_motivacional,
      email_bienvenida_inmediato: preferences.email_bienvenida_inmediato || true,
      unsubscribed_all: preferences.unsubscribed_all
    }
    
  } catch (error) {
    console.error('❌ Error general obteniendo preferencias:', error)
    // Fallback seguro: no enviar emails
    return {
      email_reactivacion: false,
      email_urgente: false,
      email_bienvenida_motivacional: false,
      email_bienvenida_inmediato: false,
      unsubscribed_all: true
    }
  }
}

// 🆕 FUNCIÓN PARA VERIFICAR SI PUEDE ENVIAR EMAIL ESPECÍFICO
export async function canSendEmailType(userId, emailType) {
  const preferences = await getEmailPreferences(userId)
  
  // Si desactivó todos los emails, no enviar nada
  if (preferences.unsubscribed_all) {
    console.log(`🚫 Usuario ${userId} ha desactivado todos los emails`)
    return false
  }
  
  // Verificar tipo específico
  switch (emailType) {
    case 'reactivacion':
      return preferences.email_reactivacion
    case 'urgente':
      return preferences.email_urgente  
    case 'bienvenida_motivacional':
      return preferences.email_bienvenida_motivacional
    case 'bienvenida_inmediato':
      return preferences.email_bienvenida_inmediato || true  // Por defecto permitir emails de bienvenida
    case 'welcome':
      return preferences.email_bienvenida_inmediato || true
    case 'resumen_semanal':  
      return preferences.email_resumen_semanal || true  
    default:
      console.log(`⚠️ Tipo de email desconocido: ${emailType}`)
      return false
  }
}

// Función de prueba
export async function testServerConnection() {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('user_profiles').select('id').limit(1)
    return { success: true, message: 'Conexión exitosa' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Detectar usuarios inactivos REALES usando función SQL CON VERIFICACIÓN DE PREFERENCIAS
export async function detectInactiveUsers() {
  try {
    console.log('🔍 Detectando usuarios inactivos reales...')
    
    const supabase = getSupabase()
    const { data: inactiveUsers, error } = await supabase.rpc('get_inactive_users_for_emails')
    
    if (error) {
      console.error('Error detectando usuarios inactivos:', error)
      return []
    }
    
    // 🆕 FILTRAR POR PREFERENCIAS DE EMAIL
    const usersWithEmailPermission = []
    
    for (const user of inactiveUsers || []) {
      // Determinar tipo de email según días de inactividad
      const emailType = user.days_inactive >= 14 ? 'urgente' : 'reactivacion'
      const canSend = await canSendEmailType(user.user_id, emailType)
      
      if (canSend) {
        usersWithEmailPermission.push(user)
      } else {
        console.log(`🚫 Usuario ${user.email} ha desactivado emails de ${emailType}`)
      }
    }
    
    console.log(`📊 Usuarios inactivos: ${inactiveUsers?.length || 0}`)
    console.log(`📧 Usuarios que SÍ quieren emails: ${usersWithEmailPermission.length}`)
    
    return usersWithEmailPermission
    
  } catch (error) {
    console.error('Error en detectInactiveUsers:', error)
    return []
  }
}

// Detectar usuarios nuevos que nunca empezaron CON VERIFICACIÓN DE PREFERENCIAS
export async function detectUnmotivatedUsers() {
  try {
    console.log('🔍 Detectando usuarios que nunca empezaron...')
    
    const supabase = getSupabase()
    const { data: unmotivatedUsers, error } = await supabase.rpc('get_unmotivated_new_users')
    
    if (error) {
      console.error('Error detectando usuarios no motivados:', error)
      return []
    }
    
    // 🆕 FILTRAR POR PREFERENCIAS DE EMAIL
    const usersWithEmailPermission = []
    
    for (const user of unmotivatedUsers || []) {
      const canSend = await canSendEmailType(user.user_id, 'bienvenida_motivacional')
      if (canSend) {
        usersWithEmailPermission.push(user)
      } else {
        console.log(`🚫 Usuario ${user.email} ha desactivado emails motivacionales`)
      }
    }
    
    console.log(`📊 Usuarios sin empezar: ${unmotivatedUsers?.length || 0}`)
    console.log(`📧 Usuarios que SÍ quieren emails: ${usersWithEmailPermission.length}`)
    
    return usersWithEmailPermission
    
  } catch (error) {
    console.error('Error en detectUnmotivatedUsers:', error)
    return []
  }
}

// Detectar usuarios que necesitan emails (combinando ambos tipos)
export async function detectUsersForEmails() {
  try {
    console.log('🔍 Detectando usuarios para emails automáticos...')
    
    // 1. Obtener usuarios inactivos (YA FILTRADOS por preferencias)
    const inactiveUsers = await detectInactiveUsers()
    
    // 2. Obtener usuarios que nunca empezaron (YA FILTRADOS por preferencias)
    const unmotivatedUsers = await detectUnmotivatedUsers()
    
    const emailQueue = []
    
    // Procesar usuarios inactivos
    for (const user of inactiveUsers) {
      const emailType = user.days_inactive >= 14 ? 'urgente' : 'reactivacion'
      emailQueue.push({
        user,
        emailType,
        priority: user.days_inactive >= 14 ? 90 : 70,
        category: 'inactive_user'
      })
    }
    
    // Procesar usuarios nuevos que nunca empezaron
    for (const user of unmotivatedUsers) {
      emailQueue.push({
        user,
        emailType: 'bienvenida_motivacional',
        priority: 60,
        category: 'unmotivated_new_user'
      })
    }
    
    // Ordenar por prioridad
    emailQueue.sort((a, b) => b.priority - a.priority)
    
    console.log(`✅ ${emailQueue.length} usuarios necesitan emails`)
    return emailQueue
    
  } catch (error) {
    console.error('❌ Error detectando usuarios para emails:', error)
    return []
  }
}

// Generar token de unsubscribe único
export async function generateUnsubscribeToken(userId, email, emailType) {
  try {
    const token = crypto.randomBytes(32).toString('hex')
    
    console.log(`🔑 Generando token de unsubscribe para ${email} (tipo: ${emailType})`)
    
    const supabase = getSupabase()
    const { data: tokenData, error } = await supabase
      .from('email_unsubscribe_tokens')
      .insert({
        user_id: userId,
        token: token,
        email: email,
        email_type: emailType,
        expires_at: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 días
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Error creando token de unsubscribe:', error)
      return null
    }
    
    console.log(`✅ Token generado: ${token}`)
    return token
    
  } catch (error) {
    console.error('❌ Error en generateUnsubscribeToken:', error)
    return null
  }
}

// 🆕 VALIDAR TOKEN DE UNSUBSCRIBE
export async function validateUnsubscribeToken(token) {
  try {
    console.log(`🔍 Validando token: ${token}`)
    
    const supabase = getSupabase()
    const { data: tokenData, error } = await supabase
      .from('email_unsubscribe_tokens')
      .select(`
        *,
        user_profiles(email, full_name)
      `)
      .eq('token', token)
      .is('used_at', null) // No usado aún
      .gt('expires_at', new Date().toISOString()) // No expirado
      .single()
    
    if (error || !tokenData) {
      console.log('❌ Token inválido, expirado o ya usado')
      return null
    }
    
    console.log(`✅ Token válido para usuario: ${tokenData.email}`)
    return {
      userId: tokenData.user_id,
      email: tokenData.email,
      emailType: tokenData.email_type,
      userProfile: tokenData.user_profiles
    }
    
  } catch (error) {
    console.error('❌ Error validando token:', error)
    return null
  }
}

// 🆕 PROCESAR UNSUBSCRIBE VIA TOKEN
export async function processUnsubscribeByToken(token, specificTypes = null, unsubscribeAll = false) {
  try {
    console.log(`🚫 Procesando unsubscribe con token: ${token}`)
    
    // Validar token
    const tokenInfo = await validateUnsubscribeToken(token)
    if (!tokenInfo) {
      return {
        success: false,
        error: 'Token inválido, expirado o ya usado'
      }
    }
    
    const { userId, email, emailType } = tokenInfo
    
    // Determinar qué desactivar
    let updateData = {}
    
    if (unsubscribeAll) {
      // 🆕 DESACTIVAR TODOS LOS EMAILS cuando el usuario explícitamente lo solicita
      console.log(`🚫 Usuario ${email} solicita desactivar TODOS los emails`)
      updateData = {
        email_reactivacion: false,
        email_urgente: false,
        email_bienvenida_motivacional: false,
        email_bienvenida_inmediato: false,
        email_resumen_semanal: false,
        unsubscribed_all: true,
        unsubscribed_at: new Date().toISOString()
      }
    } else if (specificTypes) {
      // Desactivar tipos específicos solicitados
      console.log(`🚫 Usuario ${email} solicita desactivar tipos específicos:`, specificTypes)
      specificTypes.forEach(type => {
        switch (type) {
          case 'reactivacion':
            updateData.email_reactivacion = false
            break
          case 'urgente':
            updateData.email_urgente = false
            break
          case 'bienvenida_motivacional':
            updateData.email_bienvenida_motivacional = false
            break
          case 'bienvenida_inmediato':
            updateData.email_bienvenida_inmediato = false
            break
          case 'resumen_semanal':
            updateData.email_resumen_semanal = false
            break
        }
      })
    } else {
      // Desactivar según el tipo del token (comportamiento original)
      console.log(`🚫 Desactivando según tipo de token: ${emailType}`)
      if (emailType === 'all') {
        updateData = {
          email_reactivacion: false,
          email_urgente: false,
          email_bienvenida_motivacional: false,
          email_bienvenida_inmediato: false,
          email_resumen_semanal: false,
          unsubscribed_all: true,
          unsubscribed_at: new Date().toISOString()
        }
      } else {
        switch (emailType) {
          case 'reactivacion':
            updateData.email_reactivacion = false
            break
          case 'urgente':
            updateData.email_urgente = false
            break
          case 'bienvenida_motivacional':
            updateData.email_bienvenida_motivacional = false
            break
          case 'bienvenida_inmediato':
            updateData.email_bienvenida_inmediato = false
            break
          case 'resumen_semanal':
            updateData.email_resumen_semanal = false
            break
        }
      }
    }
    
    // Actualizar preferencias de email
    const supabase = getSupabase()
    const { error: prefsError } = await supabase
      .from('email_preferences')
      .upsert({
        user_id: userId,
        ...updateData,
        updated_at: new Date().toISOString()
      })
    
    if (prefsError) {
      console.error('❌ Error actualizando preferencias:', prefsError)
      return {
        success: false,
        error: 'Error actualizando preferencias de email'
      }
    }
    
    // Marcar token como usado
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .update({
        used_at: new Date().toISOString()
      })
      .eq('token', token)
    
    if (tokenError) {
      console.error('⚠️ Error marcando token como usado:', tokenError)
      // No es crítico, continuamos
    }
    
    console.log(`✅ Unsubscribe procesado exitosamente para ${email}`)
    
    return {
      success: true,
      message: 'Preferencias de email actualizadas correctamente',
      email: email,
      updatedPreferences: updateData
    }
    
  } catch (error) {
    console.error('❌ Error en processUnsubscribeByToken:', error)
    return {
      success: false,
      error: 'Error interno procesando unsubscribe'
    }
  }
}

// Enviar email individual con Resend (FUNCIÓN PRINCIPAL CON VERIFICACIÓN DE PREFERENCIAS)
export async function sendEmail(userId, emailType, customData = {}) {
  try {
    console.log(`📧 Iniciando envío de email ${emailType} a usuario ${userId}`)
    
    // 🆕 VERIFICAR PREFERENCIAS ANTES DE ENVIAR
    const canSend = await canSendEmailType(userId, emailType)
    if (!canSend) {
      console.log(`🚫 CANCELADO: Usuario ${userId} ha desactivado emails de tipo ${emailType}`)
      return {
        success: false,
        cancelled: true,
        reason: 'user_unsubscribed',
        message: `Usuario ha desactivado emails de tipo ${emailType}`
      }
    }
    
    const supabase = getSupabase()
    
    // Obtener datos del usuario
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('email, full_name, target_oposicion')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      throw new Error(`Usuario ${userId} no encontrado: ${userError?.message}`)
    }
    
    const template = emailTemplates[emailType]
    if (!template) {
      throw new Error(`Template ${emailType} no encontrado`)
    }
    
    // Generar contenido del email
    const daysInactive = customData.daysInactive || customData.daysSince || 7
    const userName = user.full_name || 'Estudiante'
    
    // URL del test según tipo de email
    let testUrl
    testUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auxiliar-administrativo-estado/test?utm_source=email&utm_campaign=${emailType}`

    
    // Generar token de unsubscribe
    const unsubscribeToken = await generateUnsubscribeToken(userId, user.email, emailType)
    
    // URL de unsubscribe con token
    let unsubscribeUrl
    if (unsubscribeToken) {
      unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(user.email)}`
    } else {
      // Fallback
      console.warn('⚠️ No se pudo generar token, usando URL de fallback')
      unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/perfil?tab=emails&utm_source=email_unsubscribe`
    }
    
    const subject = template.subject(userName, daysInactive)
    const html = template.html(userName, daysInactive, testUrl, unsubscribeUrl)
    
    console.log(`📤 Enviando a: ${user.email}`)
    console.log(`📝 Asunto: ${subject}`)
    
    // Enviar email con Resend
    const resend = getResend()
    const emailResponse = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: user.email,
      subject: subject,
      html: html,
    })
    
    console.log('✅ Email enviado con Resend:', emailResponse)
    
    // Registrar en email_logs
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        user_id: userId,
        email_type: emailType,
        subject: subject,
        status: 'sent'
      })
    
    if (logError) {
      console.error('⚠️ Error registrando email log:', logError)
    }

    // 🆕 También registrar en email_events para tracking
    const { error: eventError } = await supabase
      .from('email_events')
      .insert({
        user_id: userId,
        email_address: user.email,
        event_type: 'sent',
        email_type: emailType,
        subject: subject,
        template_id: emailType,
        created_at: new Date().toISOString()
      })
    
    if (eventError) {
      console.error('⚠️ Error registrando evento de email:', eventError)
    } else {
      console.log('✅ Evento de email registrado en email_events')
    }
    
    return {
      success: true,
      emailId: emailResponse.data?.id,
      unsubscribeToken: unsubscribeToken,
      message: `Email ${emailType} enviado a ${user.email}`,
      details: {
        to: user.email,
        subject: subject,
        testUrl: testUrl,
        unsubscribeUrl: unsubscribeUrl,
        resendId: emailResponse.data?.id
      }
    }
    
  } catch (error) {
    console.error('❌ Error enviando email:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 🆕 NUEVA FUNCIÓN: Enviar email de bienvenida inmediato
export async function sendWelcomeEmailImmediate(userId) {
  try {
    console.log(`📧 Enviando email de bienvenida inmediato a usuario ${userId}`)
    
    // Verificar que no se haya enviado ya
    const supabase = getSupabase()
    const { data: existingEmail, error: checkError } = await supabase
      .from('email_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('email_type', 'bienvenida_inmediato')
      .single()
    
    if (existingEmail) {
      console.log(`⚠️ Email de bienvenida ya enviado a usuario ${userId}`)
      return { success: false, reason: 'already_sent', message: 'Email de bienvenida ya enviado' }
    }
    
    // Enviar email usando la función existente
    const result = await sendEmail(userId, 'bienvenida_inmediato', {})
    
    if (result.success) {
      console.log(`✅ Email de bienvenida inmediato enviado a usuario ${userId}`)
    }
    
    return result
    
  } catch (error) {
    console.error('❌ Error enviando email de bienvenida inmediato:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Ejecutar campaña de emails REAL CON VERIFICACIÓN DE PREFERENCIAS
export async function runEmailCampaign() {
  try {
    console.log('🚀 Iniciando campaña automática completa...')
    
    // 1. Obtener usuarios inactivos (YA FILTRADOS por preferencias)
    const inactiveUsers = await detectInactiveUsers()
    
    // 2. Obtener usuarios que nunca empezaron (YA FILTRADOS por preferencias)
    const unmotivatedUsers = await detectUnmotivatedUsers()
    
    console.log(`📊 Usuarios inactivos (con permiso): ${inactiveUsers.length}`)
    console.log(`📊 Usuarios nuevos (con permiso): ${unmotivatedUsers.length}`)
    
    const totalUsers = inactiveUsers.length + unmotivatedUsers.length
    
    if (totalUsers === 0) {
      return {
        total: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
        message: 'No hay usuarios con permisos de email para procesar',
        details: []
      }
    }
    
    const results = {
      total: totalUsers,
      sent: 0,
      failed: 0,
      cancelled: 0,
      details: []
    }
    
    // Procesar usuarios inactivos
    for (const user of inactiveUsers) {
      const emailType = user.days_inactive >= 14 ? 'urgente' : 'reactivacion'
      
      console.log(`📧 Procesando INACTIVO: ${user.email} (${user.days_inactive} días) - ${emailType}`)
      
      const result = await sendEmail(user.user_id, emailType, {
        daysInactive: user.days_inactive
      })
      
      if (result.success) {
        results.sent++
      } else if (result.cancelled) {
        results.cancelled++
      } else {
        results.failed++
      }
      
      results.details.push({
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        daysInactive: user.days_inactive,
        emailType: emailType,
        category: 'inactive_user',
        success: result.success,
        cancelled: result.cancelled || false,
        error: result.error || null,
        emailId: result.emailId || null
      })
      
      // Pausa entre emails
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    // Procesar usuarios que nunca empezaron
    for (const user of unmotivatedUsers) {
      const emailType = 'bienvenida_motivacional'
      
      console.log(`📧 Procesando NUEVO: ${user.email} (${user.days_since_registration} días desde registro) - ${emailType}`)
      
      const result = await sendEmail(user.user_id, emailType, {
        daysSince: user.days_since_registration
      })
      
      if (result.success) {
        results.sent++
      } else if (result.cancelled) {
        results.cancelled++
      } else {
        results.failed++
      }
      
      results.details.push({
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        daysSinceRegistration: user.days_since_registration,
        emailType: emailType,
        category: 'unmotivated_new_user',
        success: result.success,
        cancelled: result.cancelled || false,
        error: result.error || null,
        emailId: result.emailId || null
      })
      
      // Pausa entre emails
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    console.log('🎉 Campaña completa finalizada:', {
      total: results.total,
      enviados: results.sent,
      cancelados: results.cancelled,
      fallidos: results.failed,
      inactivos: inactiveUsers.length,
      nuevos: unmotivatedUsers.length
    })
    
    return results
    
  } catch (error) {
    console.error('❌ Error en campaña automática:', error)
    return {
      success: false,
      error: error.message,
      total: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      details: []
    }
  }
}

// 🆕 FUNCIÓN PARA OBTENER ESTADÍSTICAS DE CAMPAÑAS DE EMAIL
export async function getEmailCampaignStats(daysBack = 30) {
  try {
    console.log(`📊 Obteniendo estadísticas de emails de los últimos ${daysBack} días`)
    
    const supabase = getSupabase()
    const { data: emailStats, error } = await supabase
      .from('email_logs')
      .select('*')
      .gte('sent_at', new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)).toISOString())
      .order('sent_at', { ascending: false })
    
    if (error) {
      console.error('Error obteniendo estadísticas de email:', error)
      return null
    }
    
    // Calcular estadísticas por tipo
    const statsByType = {}
    let totalSent = 0
    let totalOpened = 0
    let totalClicked = 0
    
    emailStats.forEach(email => {
      const type = email.email_type
      
      if (!statsByType[type]) {
        statsByType[type] = {
          sent: 0,
          opened: 0,
          clicked: 0,
          openRate: 0,
          clickRate: 0
        }
      }
      
      statsByType[type].sent++
      totalSent++
      
      if (email.opened_at) {
        statsByType[type].opened++
        totalOpened++
      }
      
      if (email.clicked_at) {
        statsByType[type].clicked++
        totalClicked++
      }
    })
    
    // Calcular tasas
    Object.keys(statsByType).forEach(type => {
      const stats = statsByType[type]
      stats.openRate = stats.sent > 0 ? (stats.opened / stats.sent * 100).toFixed(1) : 0
      stats.clickRate = stats.sent > 0 ? (stats.clicked / stats.sent * 100).toFixed(1) : 0
    })
    
    const overallOpenRate = totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(1) : 0
    const overallClickRate = totalSent > 0 ? (totalClicked / totalSent * 100).toFixed(1) : 0
    
    return {
      period: `${daysBack} días`,
      overall: {
        totalSent,
        totalOpened,
        totalClicked,
        openRate: overallOpenRate,
        clickRate: overallClickRate
      },
      byType: statsByType,
      recentEmails: emailStats.slice(0, 10) // Últimos 10 emails
    }
    
  } catch (error) {
    console.error('Error en getEmailCampaignStats:', error)
    return null
  }
}

// 🆕 FUNCIÓN PARA VERIFICAR SALUD DEL SISTEMA DE EMAILS
export async function checkEmailSystemHealth() {
  try {
    console.log('🏥 Verificando salud del sistema de emails...')
    
    // Verificar configuración de Resend
    const resendConfigured = !!process.env.RESEND_API_KEY
    
    // Verificar configuración de Supabase
    const supabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    // Verificar acceso a tablas necesarias
    let tablesAccessible = false
    try {
      const supabase = getSupabase()
      const { error: profilesError } = await supabase.from('user_profiles').select('id').limit(1)
      const { error: preferencesError } = await supabase.from('email_preferences').select('id').limit(1)
      const { error: logsError } = await supabase.from('email_logs').select('id').limit(1)
      
      tablesAccessible = !profilesError && !preferencesError && !logsError
    } catch (tableError) {
      console.error('Error verificando acceso a tablas:', tableError)
      tablesAccessible = false
    }
    
    // Verificar funciones SQL
    let sqlFunctionsWorking = false
    try {
      const supabase = getSupabase()
      const { error: funcError } = await supabase.rpc('get_inactive_users_for_emails')
      sqlFunctionsWorking = !funcError
    } catch (funcError) {
      console.error('Error verificando funciones SQL:', funcError)
      sqlFunctionsWorking = false
    }
    
    // Obtener estadísticas recientes
    const recentStats = await getEmailCampaignStats(7)
    
    const health = {
      overall: resendConfigured && supabaseConfigured && tablesAccessible && sqlFunctionsWorking ? 'healthy' : 'issues',
      components: {
        resend: {
          status: resendConfigured ? 'ok' : 'error',
          message: resendConfigured ? 'API key configurada' : 'Falta RESEND_API_KEY'
        },
        supabase: {
          status: supabaseConfigured ? 'ok' : 'error',
          message: supabaseConfigured ? 'Configuración correcta' : 'Faltan variables de entorno'
        },
        database: {
          status: tablesAccessible ? 'ok' : 'error',
          message: tablesAccessible ? 'Acceso a todas las tablas' : 'Error accediendo a tablas'
        },
        functions: {
          status: sqlFunctionsWorking ? 'ok' : 'error',
          message: sqlFunctionsWorking ? 'Funciones SQL funcionando' : 'Error en funciones SQL'
        }
      },
      recentActivity: recentStats,
      timestamp: new Date().toISOString()
    }
    
    console.log('🏥 Verificación de salud completada:', health.overall)
    return health
    
  } catch (error) {
    console.error('❌ Error verificando salud del sistema:', error)
    return {
      overall: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

// 🆕 FUNCIÓN AUXILIAR: LIMPIAR TOKENS EXPIRADOS
export async function cleanupExpiredTokens() {
  try {
    console.log('🧹 Limpiando tokens expirados...')
    
    const supabase = getSupabase()
    const { data: deletedTokens, error } = await supabase
      .from('email_unsubscribe_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('count')
    
    if (error) {
      console.error('❌ Error limpiando tokens:', error)
      return 0
    }
    
    const count = deletedTokens?.length || 0
    console.log(`✅ ${count} tokens expirados eliminados`)
    return count
    
  } catch (error) {
    console.error('❌ Error en cleanupExpiredTokens:', error)
    return 0
  }
}

// 🆕 SISTEMA DE EMAILS SEMANALES - AGREGAR AL FINAL DE emailService.server.js (antes de la clase EmailService)

// 🆕 DETECTAR USUARIOS QUE NECESITAN RESUMEN SEMANAL
export async function detectUsersForWeeklyReport() {
  try {
    console.log('🔍 Detectando usuarios para resumen semanal...')
    
    const supabase = getSupabase()
    
    // Obtener usuarios activos que han hecho tests esta semana
    const { data: activeUsers, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        full_name,
        target_oposicion
      `)
      .eq('is_active_student', true)
      .not('email', 'is', null)
    
    if (error) {
      console.error('Error obteniendo usuarios activos:', error)
      return []
    }
    
    const usersForWeeklyReport = []
    
    // Para cada usuario, verificar si tiene artículos problemáticos esta semana
    for (const user of activeUsers || []) {
      try {
        // Verificar si puede recibir emails semanales
        const canSend = await canSendEmailType(user.id, 'resumen_semanal')
        if (!canSend) {
          console.log(`🚫 Usuario ${user.email} ha desactivado emails semanales`)
          continue
        }
        
        // Verificar si ya se envió email semanal en los últimos 6 días (evitar duplicados)
        const { data: recentEmail } = await supabase
          .from('email_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('email_type', 'resumen_semanal')
          .gte('sent_at', new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)).toISOString())
          .single()
        
        if (recentEmail) {
          console.log(`⏭️ Usuario ${user.email} ya recibió resumen semanal reciente`)
          continue
        }
        
        // Obtener artículos problemáticos de esta semana
        const { data: problematicArticles, error: articlesError } = await supabase
          .rpc('get_user_problematic_articles_weekly', { user_uuid: user.id })
        
        if (articlesError) {
          console.warn(`⚠️ Error obteniendo artículos problemáticos para ${user.email}:`, articlesError)
          continue
        }
        
        // Si tiene artículos problemáticos, agregarlo a la lista
        if (problematicArticles && problematicArticles.length > 0) {
          console.log(`📊 Usuario ${user.email}: ${problematicArticles.length} artículos problemáticos`)
          
          usersForWeeklyReport.push({
            ...user,
            problematicArticles: problematicArticles,
            articlesCount: problematicArticles.length
          })
        } else {
          console.log(`✅ Usuario ${user.email}: sin artículos problemáticos esta semana`)
        }
        
      } catch (userError) {
        console.warn(`⚠️ Error procesando usuario ${user.email}:`, userError)
        continue
      }
    }
    
    console.log(`📧 ${usersForWeeklyReport.length} usuarios necesitan resumen semanal`)
    return usersForWeeklyReport
    
  } catch (error) {
    console.error('❌ Error en detectUsersForWeeklyReport:', error)
    return []
  }
}

// 🆕 ENVIAR EMAIL SEMANAL CON ARTÍCULOS PROBLEMÁTICOS
export async function sendWeeklyReportEmail(userId, articlesData = []) {
  try {
    console.log(`📧 Enviando resumen semanal a usuario ${userId} con ${articlesData.length} artículos`)
    
    // Verificar que no se haya enviado ya esta semana
    const supabase = getSupabase()
    const { data: recentEmail } = await supabase
      .from('email_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('email_type', 'resumen_semanal')
      .gte('sent_at', new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)).toISOString())
      .single()
    
    if (recentEmail) {
      console.log(`⚠️ Resumen semanal ya enviado a usuario ${userId}`)
      return { success: false, reason: 'already_sent', message: 'Resumen semanal ya enviado esta semana' }
    }
    
    // Verificar preferencias de email
    const canSend = await canSendEmailType(userId, 'resumen_semanal')
    if (!canSend) {
      console.log(`🚫 CANCELADO: Usuario ${userId} ha desactivado emails semanales`)
      return {
        success: false,
        cancelled: true,
        reason: 'user_unsubscribed',
        message: 'Usuario ha desactivado emails semanales'
      }
    }
    
    // Obtener datos del usuario
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('email, full_name, target_oposicion')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      throw new Error(`Usuario ${userId} no encontrado: ${userError?.message}`)
    }
    
    const template = emailTemplates['resumen_semanal']
    if (!template) {
      throw new Error('Template resumen_semanal no encontrado')
    }
    
    const userName = user.full_name || 'Estudiante'
    
    // Generar URL de test dirigido con los artículos problemáticos
    const articleIds = articlesData.map(a => a.article_id).join(',')
    const testUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auxiliar-administrativo-estado/test/articulos-dirigido?articles=${encodeURIComponent(articleIds)}&utm_source=email&utm_campaign=resumen_semanal`
    
    // Generar token de unsubscribe
    const unsubscribeToken = await generateUnsubscribeToken(userId, user.email, 'resumen_semanal')
    
    // URL de unsubscribe
    let unsubscribeUrl
    if (unsubscribeToken) {
      unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(user.email)}`
    } else {
      unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/perfil?tab=emails&utm_source=email_unsubscribe`
    }
    
    const subject = template.subject(userName, articlesData.length)
    const html = template.html(userName, 0, testUrl, unsubscribeUrl, articlesData)
    
    console.log(`📤 Enviando resumen semanal a: ${user.email}`)
    console.log(`📝 Asunto: ${subject}`)
    
    // Enviar email con Resend
    const resend = getResend()
    const emailResponse = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: user.email,
      subject: subject,
      html: html,
    })
    
    console.log('✅ Resumen semanal enviado con Resend:', emailResponse)
    
    // Registrar en email_logs
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        user_id: userId,
        email_type: 'resumen_semanal',
        subject: subject,
        status: 'sent'
      })
    
    if (logError) {
      console.error('⚠️ Error registrando email log:', logError)
    }
    
    return {
      success: true,
      emailId: emailResponse.data?.id,
      unsubscribeToken: unsubscribeToken,
      message: `Resumen semanal enviado a ${user.email}`,
      details: {
        to: user.email,
        subject: subject,
        testUrl: testUrl,
        unsubscribeUrl: unsubscribeUrl,
        resendId: emailResponse.data?.id,
        articlesCount: articlesData.length
      }
    }
    
  } catch (error) {
    console.error('❌ Error enviando resumen semanal:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 🆕 EJECUTAR CAMPAÑA DE EMAILS SEMANALES
export async function runWeeklyReportCampaign() {
  try {
    console.log('🚀 Iniciando campaña de resumenes semanales...')
    
    // Obtener usuarios que necesitan resumen semanal
    const usersForWeeklyReport = await detectUsersForWeeklyReport()
    
    console.log(`📊 Usuarios para resumen semanal: ${usersForWeeklyReport.length}`)
    
    if (usersForWeeklyReport.length === 0) {
      return {
        total: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
        message: 'No hay usuarios que necesiten resumen semanal',
        details: []
      }
    }
    
    const results = {
      total: usersForWeeklyReport.length,
      sent: 0,
      failed: 0,
      cancelled: 0,
      details: []
    }
    
    // Procesar cada usuario
    for (const user of usersForWeeklyReport) {
      console.log(`📧 Procesando RESUMEN SEMANAL: ${user.email} (${user.articlesCount} artículos)`)
      
      const result = await sendWeeklyReportEmail(user.id, user.problematicArticles)
      
      if (result.success) {
        results.sent++
      } else if (result.cancelled) {
        results.cancelled++
      } else {
        results.failed++
      }
      
      results.details.push({
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        articlesCount: user.articlesCount,
        emailType: 'resumen_semanal',
        category: 'weekly_report',
        success: result.success,
        cancelled: result.cancelled || false,
        error: result.error || null,
        emailId: result.emailId || null
      })
      
      // Pausa entre emails
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log('🎉 Campaña de resumenes semanales finalizada:', {
      total: results.total,
      enviados: results.sent,
      cancelados: results.cancelled,
      fallidos: results.failed
    })
    
    return results
    
  } catch (error) {
    console.error('❌ Error en campaña de resumenes semanales:', error)
    return {
      success: false,
      error: error.message,
      total: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      details: []
    }
  }
}

// Mantener compatibilidad: Clase EmailService para funciones del archivo original
export class EmailService {
  constructor() {
    this.templates = {
      reactivation_urgent: {
        subject: '¡Te echamos de menos! 🎯 Tu progreso en iLoveTest te espera',
        type: 'reactivation',
        trigger: { days_inactive: 7, max_days: 14 }
      },
      reactivation_gentle: {
        subject: '📚 ¿Todo bien? Te hemos preparado algo especial',
        type: 'reactivation',
        trigger: { days_inactive: 3, max_days: 7 }
      }
    }
  }

  async detectUsersForEmails() {
    return await detectUsersForEmails()
  }

  async runEmailCampaign() {
    return await runEmailCampaign()
  }
}

// Exportar instancia para compatibilidad
export const emailService = new EmailService()
