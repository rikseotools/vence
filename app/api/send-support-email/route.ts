import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmailV2 } from '@/lib/api/emails'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables de entorno de Supabase no configuradas')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Verificar si un usuario está activamente navegando (últimos 5 segundos)
async function isUserActivelyBrowsing(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabase()

    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error && error.code !== 'PGRST116') return false
    if (!sessions || sessions.length === 0) return false

    const lastActivity = new Date(sessions[0].updated_at)
    const secondsSinceLastActivity = (Date.now() - lastActivity.getTime()) / 1000
    return secondsSinceLastActivity <= 5
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const { userId, adminMessage, conversationId } = await request.json()

    if (!userId || !adminMessage || !conversationId) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    // Skip email if user is actively browsing (they'll see it in the chat)
    if (await isUserActivelyBrowsing(userId)) {
      return NextResponse.json({ sent: false, reason: 'user_actively_browsing' })
    }

    const baseUrl = 'https://www.vence.es'
    const chatUrl = `${baseUrl}/soporte?conversation_id=${conversationId}`

    const result = await sendEmailV2({
      userId,
      emailType: 'soporte_respuesta',
      customData: {
        adminMessage,
        chatUrl,
      },
    })

    if (result.success) {
      return NextResponse.json({ sent: true, emailId: result.emailId })
    }

    if ('cancelled' in result && result.cancelled) {
      return NextResponse.json({ sent: false, reason: 'emails_disabled' })
    }

    return NextResponse.json({
      sent: false,
      reason: 'send_error',
      error: 'error' in result ? result.error : 'Unknown error',
    })

  } catch (error) {
    console.error('❌ Error en API send-support-email:', error)
    return NextResponse.json(
      { sent: false, reason: 'api_error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
