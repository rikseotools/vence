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

// Verificar si un usuario está activamente navegando (últimos 30 segundos)
async function isUserActivelyBrowsing(userId) {
  try {
    // TODO: Implementar sistema de tracking de actividad de usuario
    // Por ahora, retornamos false para enviar siempre emails
    console.log(`👤 Usuario ${userId}: Sin sistema de tracking de actividad, enviando email por defecto`)
    return false
  } catch (error) {
    console.error('Error verificando estado activo del usuario:', error)
    return false // En caso de error, enviar email por seguridad
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

// Enviar email de respuesta de soporte (mejorado para chat conversacional)
export async function sendSupportResponseEmail(userId, adminMessage, conversationId) {
  try {
    console.log(`📧 INICIANDO sendSupportResponseEmail para usuario: ${userId}`)
    console.log(`📧 AdminMessage: "${adminMessage}"`)
    console.log(`📧 ConversationId: ${conversationId}`)
    
    // 1. Verificar si el usuario está navegando activamente (solo últimos 30 segundos)
    const userIsActivelyBrowsing = await isUserActivelyBrowsing(userId)
    if (userIsActivelyBrowsing) {
      console.log(`✋ Usuario está NAVEGANDO ACTIVAMENTE (últimos 30s) - no enviando email`)
      return { sent: false, reason: 'user_actively_browsing' }
    }

    // 2. Verificar preferencias de email del usuario
    const preferences = await getEmailPreferences(userId)
    console.log(`📧 Preferencias de email obtenidas:`, preferences)
    if (preferences.unsubscribed_all) {
      console.log(`✋ Usuario tiene todos los emails desactivados - no enviando email`)
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
    const customData = {
      to: userInfo.email,
      userName: userInfo.full_name || 'Usuario',
      adminMessage: adminMessage,
      chatUrl: chatUrl,
      unsubscribeUrl: unsubscribeUrl
    }

    // 6. Enviar email
    console.log(`📧 Enviando email de soporte a: ${userInfo.email}`)
    const result = await sendEmail(userId, 'soporte_respuesta', customData)

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