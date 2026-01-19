// lib/adminConversationTracking.js - Sistema de tracking de conversaciones vistas por admin
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

/**
 * Marcar una conversación como vista por el admin
 */
export async function markConversationAsViewed(conversationId) {
  try {
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('feedback_conversations')
      .update({ 
        admin_viewed_at: new Date().toISOString() 
      })
      .eq('id', conversationId)
      .is('admin_viewed_at', null) // Solo actualizar si no ha sido vista antes
    
    if (error) throw error
    
    console.log(`✅ Conversación ${conversationId} marcada como vista`)
    return { success: true }
    
  } catch (error) {
    console.error('❌ Error marcando conversación como vista:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Marcar múltiples conversaciones como vistas
 */
export async function markConversationsAsViewed(conversationIds) {
  try {
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('feedback_conversations')
      .update({ 
        admin_viewed_at: new Date().toISOString() 
      })
      .in('id', conversationIds)
      .is('admin_viewed_at', null)
    
    if (error) throw error
    
    console.log(`✅ ${conversationIds.length} conversaciones marcadas como vistas`)
    return { success: true }
    
  } catch (error) {
    console.error('❌ Error marcando conversaciones como vistas:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtener conversaciones no vistas por admin
 */
export async function getUnviewedConversationsCount() {
  try {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('feedback_conversations')
      .select('id', { count: 'exact' })
      .eq('status', 'open')
      .is('admin_viewed_at', null)

    if (error) throw error

    return { success: true, count: data?.length || 0 }

  } catch (error) {
    console.error('❌ Error obteniendo conversaciones no vistas:', error)
    return { success: false, count: 0, error: error.message }
  }
}

/**
 * Marcar mensajes como leídos por admin
 */
export async function markMessagesAsRead(conversationId) {
  try {
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('feedback_messages')
      .update({ 
        read_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .eq('is_admin', false) // Solo marcar mensajes del usuario como leídos
      .is('read_at', null) // Solo los que no han sido leídos (read_at es null)
    
    if (error) throw error
    
    console.log(`✅ Mensajes de conversación ${conversationId} marcados como leídos`)
    return { success: true }
    
  } catch (error) {
    console.error('❌ Error marcando mensajes como leídos:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Función cliente para usar en frontend (sin service role key)
 */
export function createClientConversationTracker(supabaseClient) {
  return {
    async markAsViewed(conversationId) {
      // Esta función debe ser llamada desde una API route para usar service role
      const response = await fetch('/api/admin/mark-conversation-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      })
      return response.json()
    },
    
    async markMessagesAsRead(conversationId) {
      const response = await fetch('/api/admin/mark-messages-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      })
      return response.json()
    },
    
    async getUnviewedCount() {
      // Para el conteo, podemos usar el cliente normal ya que son datos que el admin puede ver
      const { data, error } = await supabaseClient
        .from('feedback_conversations')
        .select('id', { count: 'exact' })
        .eq('status', 'waiting_admin')
        .is('admin_viewed_at', null)
      
      if (error) {
        console.error('❌ Error obteniendo conteo:', error)
        return { success: false, count: 0 }
      }
      
      return { success: true, count: data?.length || 0 }
    }
  }
}