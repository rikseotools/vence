// lib/adminConversationTracking.ts - Sistema de tracking de conversaciones vistas por admin
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any

interface TrackingResult {
  success: boolean
  error?: string
}

interface CountResult extends TrackingResult {
  count: number
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

export async function markConversationAsViewed(conversationId: string): Promise<TrackingResult> {
  try {
    const supabase = getSupabase()

    const { error } = await supabase
      .from('feedback_conversations')
      .update({
        admin_viewed_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .is('admin_viewed_at', null)

    if (error) throw error

    console.log(`✅ Conversación ${conversationId} marcada como vista`)
    return { success: true }

  } catch (error) {
    console.error('❌ Error marcando conversación como vista:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function markConversationsAsViewed(conversationIds: string[]): Promise<TrackingResult> {
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
    return { success: false, error: (error as Error).message }
  }
}

export async function getUnviewedConversationsCount(): Promise<CountResult> {
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
    return { success: false, count: 0, error: (error as Error).message }
  }
}

export async function markMessagesAsRead(conversationId: string): Promise<TrackingResult> {
  try {
    const supabase = getSupabase()

    const { error } = await supabase
      .from('feedback_messages')
      .update({
        read_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .eq('is_admin', false)
      .is('read_at', null)

    if (error) throw error

    console.log(`✅ Mensajes de conversación ${conversationId} marcados como leídos`)
    return { success: true }

  } catch (error) {
    console.error('❌ Error marcando mensajes como leídos:', error)
    return { success: false, error: (error as Error).message }
  }
}

export function createClientConversationTracker(supabaseClient: SupabaseClientAny) {
  return {
    async markAsViewed(conversationId: string): Promise<TrackingResult> {
      const response = await fetch('/api/admin/mark-conversation-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      })
      return response.json()
    },

    async markMessagesAsRead(conversationId: string): Promise<TrackingResult> {
      const response = await fetch('/api/admin/mark-messages-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      })
      return response.json()
    },

    async getUnviewedCount(): Promise<CountResult> {
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
