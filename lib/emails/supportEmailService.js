import 'server-only'
import { sendEmail, getEmailPreferences } from './emailService.server.js'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables de entorno de Supabase no configuradas')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Verificar si un usuario está online (últimos 5 minutos)
async function isUserOnline(userId) {
  try {
    const supabase = getSupabase()
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('last_seen_at')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error verificando si usuario está online:', error)
      return false // En caso de error, asumir que no está online para enviar email
    }

    if (!data?.last_seen_at) {
      return false // No hay fecha de última actividad
    }

    const lastSeen = new Date(data.last_seen_at)
    const fiveMinutesAgoDate = new Date(fiveMinutesAgo)
    
    const isOnline = lastSeen > fiveMinutesAgoDate
    console.log(`👤 Usuario ${userId} ${isOnline ? 'ONLINE' : 'OFFLINE'} (última actividad: ${lastSeen.toISOString()})`)
    
    return isOnline
  } catch (error) {
    console.error('Error verificando estado online del usuario:', error)
    return false // En caso de error, asumir offline para enviar email
  }
}

// Obtener información del usuario
async function getUserInfo(userId) {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error obteniendo información del usuario:', error)
    return null
  }
}

// Enviar email de respuesta de soporte solo si el usuario NO está online
export async function sendSupportResponseEmail(userId, adminMessage, conversationId) {
  try {
    console.log(`📧 Verificando envío de email de soporte para usuario: ${userId}`)
    
    // 1. Verificar si el usuario está online
    const userIsOnline = await isUserOnline(userId)
    if (userIsOnline) {
      console.log(`✋ Usuario está ONLINE - no enviando email`)
      return { sent: false, reason: 'user_online' }
    }

    // 2. Verificar preferencias de email del usuario
    const preferences = await getEmailPreferences(userId)
    if (preferences.emails_disabled || preferences.email_soporte_disabled) {
      console.log(`✋ Usuario tiene emails de soporte desactivados - no enviando email`)
      return { sent: false, reason: 'emails_disabled' }
    }

    // 3. Obtener información del usuario
    const userInfo = await getUserInfo(userId)
    if (!userInfo) {
      console.log(`❌ No se pudo obtener información del usuario`)
      return { sent: false, reason: 'user_info_error' }
    }

    // 4. Crear URLs
    const chatUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'}/soporte?conversation_id=${conversationId}`
    const unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'}/perfil`

    // 5. Preparar datos del email
    const emailData = {
      to: userInfo.email,
      type: 'soporte_respuesta',
      templateData: {
        userName: userInfo.full_name || 'Usuario',
        adminMessage: adminMessage,
        chatUrl: chatUrl,
        unsubscribeUrl: unsubscribeUrl
      },
      userId: userId
    }

    // 6. Enviar email
    console.log(`📧 Enviando email de soporte a: ${userInfo.email}`)
    const result = await sendEmail(emailData)

    if (result.success) {
      console.log(`✅ Email de soporte enviado exitosamente`)
      return { sent: true, emailId: result.emailId }
    } else {
      console.error(`❌ Error enviando email de soporte:`, result.error)
      return { sent: false, reason: 'send_error', error: result.error }
    }

  } catch (error) {
    console.error('❌ Error en sendSupportResponseEmail:', error)
    return { sent: false, reason: 'general_error', error: error.message }
  }
}