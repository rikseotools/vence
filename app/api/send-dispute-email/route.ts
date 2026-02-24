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

interface DisputeInfo {
  id: string
  user_id: string
  question_id: string
  status: string
  admin_response: string | null
  resolved_at: string | null
  created_at: string | null
  user_profiles: { email: string; full_name: string | null } | null
  questions: { question_text: string } | null
}

// Obtener información del usuario y la disputa con retry para read consistency
async function getDisputeInfo(disputeId: string, retryCount = 0): Promise<DisputeInfo | null> {
  try {
    const supabase = getSupabase()

    const { data: disputeData, error: disputeError } = await supabase
      .from('question_disputes')
      .select('*')
      .eq('id', disputeId)
      .single()

    if (disputeError || !disputeData) {
      throw new Error('Disputa no encontrada')
    }

    // Si el status es 'pending' y es un retry desde trigger, esperar y reintentar
    if (disputeData.status === 'pending' && retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 200))
      return getDisputeInfo(disputeId, retryCount + 1)
    }

    const { data: userData } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', disputeData.user_id)
      .single()

    const { data: questionData } = await supabase
      .from('questions')
      .select('question_text')
      .eq('id', disputeData.question_id)
      .single()

    return {
      ...disputeData,
      user_profiles: userData,
      questions: questionData,
    }
  } catch (error) {
    console.error('Error obteniendo información de la disputa:', error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { disputeId } = body

    if (!disputeId) {
      return NextResponse.json({
        success: false,
        error: 'disputeId es requerido',
      }, { status: 400 })
    }

    // 1. Obtener información de la disputa
    const disputeInfo = await getDisputeInfo(disputeId)
    if (!disputeInfo) {
      return NextResponse.json({
        success: false,
        error: 'Disputa no encontrada',
      }, { status: 404 })
    }

    // 2. Solo enviar email si hay respuesta del admin
    if (!disputeInfo.admin_response || !disputeInfo.admin_response.trim()) {
      return NextResponse.json({
        success: true,
        message: 'Email no enviado - sin respuesta del admin',
        disputeId,
      })
    }

    // 3. Enviar email usando v2
    const baseUrl = 'https://www.vence.es'
    const disputeUrl = `${baseUrl}/soporte?tab=impugnaciones&dispute_id=${disputeId}`

    const result = await sendEmailV2({
      userId: disputeInfo.user_id,
      emailType: 'impugnacion_respuesta',
      customData: {
        to: disputeInfo.user_profiles?.email,
        userName: disputeInfo.user_profiles?.full_name || 'Usuario',
        status: disputeInfo.status,
        adminResponse: disputeInfo.admin_response,
        questionText: disputeInfo.questions?.question_text,
        disputeUrl,
      },
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        emailId: result.emailId,
        disputeId,
      })
    }

    if ('cancelled' in result && result.cancelled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: result.reason,
        message: result.message,
        disputeId,
      })
    }

    console.error('❌ API: Error enviando email de impugnación:', 'error' in result ? result.error : 'Unknown')
    return NextResponse.json({
      success: false,
      error: ('error' in result ? result.error : null) || 'Error enviando email',
    }, { status: 500 })

  } catch (error) {
    console.error('❌ API: Error en send-dispute-email:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 })
  }
}
