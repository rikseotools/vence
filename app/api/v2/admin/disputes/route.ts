// app/api/v2/admin/disputes/route.ts - API server-side para gestión de impugnaciones
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { resolveDispute } from '@/lib/api/v2/dispute'

const getServiceSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mensaje genérico que se envía cuando el admin pulsa "Rechazar" sin texto.
// Coincide literalmente con el mensaje histórico (preserva comportamiento de email
// tras la migración del trigger PG → resolveDispute() in-process).
const GENERIC_REJECT_MESSAGE =
  'Impugnación cerrada por el administrador sin respuesta específica.'

// GET: Cargar todas las impugnaciones con usuarios y preguntas
async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const supabase = getServiceSupabase()

    // 1. Impugnaciones normales via RPC
    const { data: normalDisputes, error: normalError } = await supabase.rpc('get_disputes_with_users_debug')
    if (normalError) throw normalError

    // 2. Impugnaciones psicotécnicas
    const { data: psychoDisputes } = await supabase
      .from('psychometric_question_disputes')
      .select('id, question_id, user_id, dispute_type, description, status, created_at, admin_response, source, ai_chat_log_id')
      .order('created_at', { ascending: false })

    // 3. Enriquecer psicotécnicas con datos de usuario y pregunta
    let enrichedPsychoDisputes: Record<string, unknown>[] = []
    if (psychoDisputes && psychoDisputes.length > 0) {
      const userIds = [...new Set(psychoDisputes.map(d => d.user_id).filter(Boolean))]
      const questionIds = [...new Set(psychoDisputes.map(d => d.question_id).filter(Boolean))]

      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      const { data: questions } = await supabase
        .from('psychometric_questions')
        .select('id, question_text, question_subtype')
        .in('id', questionIds)

      const userMap = new Map((userProfiles || []).map(u => [u.id, u]))
      const questionMap = new Map((questions || []).map(q => [q.id, q]))

      enrichedPsychoDisputes = psychoDisputes.map(d => ({
        ...d,
        isPsychometric: true,
        user_full_name: userMap.get(d.user_id)?.full_name || null,
        user_email: userMap.get(d.user_id)?.email || null,
        question_text: questionMap.get(d.question_id)?.question_text || null,
        question_subtype: questionMap.get(d.question_id)?.question_subtype || null,
      }))
    }

    // 4. Obtener usuarios premium
    const allDisputes = [...(normalDisputes || []), ...(psychoDisputes || [])]
    let premiumUserIds: string[] = []
    if (allDisputes.length > 0) {
      const userIds = [...new Set(allDisputes.map(d => d.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data: premiumData } = await supabase
          .from('user_profiles')
          .select('id')
          .in('id', userIds)
          .in('plan_type', ['premium', 'trial'])
        premiumUserIds = (premiumData || []).map(p => p.id)
      }
    }

    return NextResponse.json({
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalDisputes: (normalDisputes || []).map((d: any) => ({ ...d, isPsychometric: false })),
      psychometricDisputes: enrichedPsychoDisputes,
      premiumUserIds,
    })
  } catch (error) {
    console.error('Error loading disputes:', error)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

// POST: Cerrar/rechazar una impugnación (sin texto custom)
//
// Ahora delega en resolveDispute() para usar el flujo in-process (Drizzle + sendEmailV2)
// en lugar del antiguo trigger PG → http_post (frágil ante cold starts de Vercel).
// El comportamiento visible para el usuario se preserva: status='rejected', mismo
// admin_response hardcoded y mismo email.
async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const { disputeId, isPsychometric } = await request.json()

    if (!disputeId) {
      return NextResponse.json({ success: false, error: 'disputeId requerido' }, { status: 400 })
    }

    const result = await resolveDispute({
      disputeId,
      questionType: isPsychometric ? 'psychometric' : 'legislative',
      status: 'rejected',
      adminResponse: GENERIC_REJECT_MESSAGE,
    })

    if (!result.success) {
      const status = result.error.includes('no encontrada') ? 404 :
                     result.error.includes('ya estaba') ? 409 : 500
      return NextResponse.json({ success: false, error: result.error }, { status })
    }

    return NextResponse.json({
      success: true,
      emailSent: result.emailSent,
      emailId: result.emailId,
      emailError: result.emailError,
    })
  } catch (error) {
    console.error('Error closing dispute:', error)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/v2/admin/disputes', _GET)
export const POST = withErrorLogging('/api/v2/admin/disputes', _POST)
