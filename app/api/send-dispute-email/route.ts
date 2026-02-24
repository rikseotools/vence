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

// Datos de la disputa: vienen directos del webhook o se leen de BD
interface DisputeData {
  id: string
  user_id: string
  question_id: string
  status: string
  admin_response: string | null
}

// Info adicional que siempre se consulta (datos estables, sin problemas de consistency)
async function getSupplementaryInfo(userId: string, questionId: string) {
  const supabase = getSupabase()

  const [userResult, questionResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single(),
    supabase
      .from('questions')
      .select('question_text')
      .eq('id', questionId)
      .single(),
  ])

  return {
    userEmail: userResult.data?.email as string | undefined,
    userName: userResult.data?.full_name as string | null | undefined,
    questionText: questionResult.data?.question_text as string | undefined,
  }
}

// Fallback: leer disputa de BD con retry para read consistency (webhook)
async function getDisputeFromDB(disputeId: string, retryCount = 0): Promise<DisputeData | null> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('question_disputes')
    .select('id, user_id, question_id, status, admin_response')
    .eq('id', disputeId)
    .single()

  if (error || !data) return null

  // Si el status es 'pending', la BD aún no refleja el UPDATE → reintentar
  if (data.status === 'pending' && retryCount < 3) {
    await new Promise(resolve => setTimeout(resolve, 300))
    return getDisputeFromDB(disputeId, retryCount + 1)
  }

  return data as DisputeData
}

// Extraer datos de disputa del body según el origen
function parseDisputeFromBody(body: Record<string, unknown>): { dispute: DisputeData | null; disputeId: string | null; source: string } {
  // Formato 1 - Supabase Database Webhook: { type, table, record: { id, user_id, ... } }
  if (body.record && typeof body.record === 'object') {
    const record = body.record as Record<string, unknown>
    if (record.id && record.user_id && record.question_id) {
      return {
        dispute: {
          id: record.id as string,
          user_id: record.user_id as string,
          question_id: record.question_id as string,
          status: record.status as string,
          admin_response: (record.admin_response as string) || null,
        },
        disputeId: record.id as string,
        source: 'webhook',
      }
    }
  }

  // Formato 2 - Trigger PostgreSQL (http_post): { disputeId, status, adminResponse, userId, questionId }
  if (body.disputeId && body.userId && body.questionId) {
    return {
      dispute: {
        id: body.disputeId as string,
        user_id: body.userId as string,
        question_id: body.questionId as string,
        status: body.status as string,
        admin_response: (body.adminResponse as string) || null,
      },
      disputeId: body.disputeId as string,
      source: 'trigger',
    }
  }

  // Formato 3 - Admin panel: { disputeId } (solo ID, datos se leen de BD)
  if (body.disputeId && typeof body.disputeId === 'string') {
    return { dispute: null, disputeId: body.disputeId, source: 'api' }
  }

  return { dispute: null, disputeId: null, source: 'unknown' }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { dispute: webhookDispute, disputeId, source } = parseDisputeFromBody(body)

    if (!disputeId) {
      return NextResponse.json({
        success: false,
        error: 'disputeId es requerido',
      }, { status: 400 })
    }

    // 1. Obtener datos de la disputa (directo del webhook o fallback a BD)
    const dispute = webhookDispute ?? await getDisputeFromDB(disputeId)

    if (!dispute) {
      console.error(`❌ [dispute-email] Disputa no encontrada: ${disputeId} (source: ${source})`)
      return NextResponse.json({
        success: false,
        error: 'Disputa no encontrada',
      }, { status: 404 })
    }

    // 2. Solo enviar email si hay respuesta del admin
    if (!dispute.admin_response?.trim()) {
      return NextResponse.json({
        success: true,
        message: 'Email no enviado - sin respuesta del admin',
        disputeId,
      })
    }

    // 3. Obtener info adicional (email usuario, texto pregunta)
    const info = await getSupplementaryInfo(dispute.user_id, dispute.question_id)

    if (!info.userEmail) {
      console.error(`❌ [dispute-email] Email de usuario no encontrado: ${dispute.user_id}`)
      return NextResponse.json({
        success: false,
        error: 'Email de usuario no encontrado',
      }, { status: 404 })
    }

    // 4. Enviar email usando v2
    const disputeUrl = `https://www.vence.es/soporte?tab=impugnaciones&dispute_id=${disputeId}`

    const result = await sendEmailV2({
      userId: dispute.user_id,
      emailType: 'impugnacion_respuesta',
      customData: {
        to: info.userEmail,
        userName: info.userName || 'Usuario',
        status: dispute.status,
        adminResponse: dispute.admin_response,
        questionText: info.questionText,
        disputeUrl,
      },
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        emailId: result.emailId,
        disputeId,
        source,
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

    console.error('❌ [dispute-email] Error enviando:', 'error' in result ? result.error : 'Unknown')
    return NextResponse.json({
      success: false,
      error: ('error' in result ? result.error : null) || 'Error enviando email',
    }, { status: 500 })

  } catch (error) {
    console.error('❌ [dispute-email] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 })
  }
}
