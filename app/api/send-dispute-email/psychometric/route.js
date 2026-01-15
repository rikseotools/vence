import { NextResponse } from 'next/server'
import { sendEmail } from '../../../../lib/emails/emailService.server.js'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables de entorno de Supabase no configuradas')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
  )
}

async function getDisputeInfo(disputeId) {
  try {
    const supabase = getSupabase()

    console.log(`🔍 API: Buscando disputa psicotécnica con ID: ${disputeId}`)

    // Obtener la disputa
    const { data: disputeData, error: disputeError } = await supabase
      .from('psychometric_question_disputes')
      .select('*')
      .eq('id', disputeId)
      .single()

    if (disputeError || !disputeData) {
      throw new Error('Disputa psicotécnica no encontrada')
    }

    // Obtener user info
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', disputeData.user_id)
      .single()

    // Obtener la pregunta psicotécnica
    const { data: questionData, error: questionError } = await supabase
      .from('psychometric_questions')
      .select('question_text, question_subtype')
      .eq('id', disputeData.question_id)
      .single()

    return {
      ...disputeData,
      user_profiles: userData,
      questions: questionData
    }
  } catch (error) {
    console.error('Error obteniendo información de la disputa psicotécnica:', error)
    return null
  }
}

export async function POST(request) {
  try {
    console.log(`📧 API: Iniciando envío de email de impugnación psicotécnica`)

    const body = await request.json()
    const { disputeId } = body

    if (!disputeId) {
      return NextResponse.json({
        success: false,
        error: 'disputeId es requerido'
      }, { status: 400 })
    }

    console.log(`📧 API: Procesando disputa psicotécnica ID: ${disputeId}`)

    // 1. Obtener información de la disputa
    const disputeInfo = await getDisputeInfo(disputeId)
    if (!disputeInfo) {
      return NextResponse.json({
        success: false,
        error: 'Disputa psicotécnica no encontrada'
      }, { status: 404 })
    }

    // 2. Solo enviar email si hay respuesta del admin
    if (!disputeInfo.admin_response || !disputeInfo.admin_response.trim()) {
      console.log(`⏭️ API: No hay admin_response, saltando envío de email`)
      return NextResponse.json({
        success: true,
        message: 'Email no enviado - sin respuesta del admin',
        disputeId: disputeId
      })
    }

    console.log(`📧 API: Disputa encontrada para usuario: ${disputeInfo.user_profiles?.email}`)

    // 3. Crear URLs
    const baseUrl = 'https://www.vence.es'
    const disputeUrl = `${baseUrl}/soporte?tab=impugnaciones`
    const unsubscribeUrl = `${baseUrl}/perfil`

    // 4. Preparar datos del email
    const customData = {
      to: disputeInfo.user_profiles?.email,
      userName: disputeInfo.user_profiles?.full_name || 'Usuario',
      status: disputeInfo.status,
      adminResponse: disputeInfo.admin_response,
      questionText: disputeInfo.questions?.question_text || 'Pregunta psicotécnica',
      questionType: 'psicotécnica',
      disputeUrl: disputeUrl,
      unsubscribeUrl: unsubscribeUrl
    }

    console.log(`📧 API: Enviando email psicotécnico a: ${disputeInfo.user_profiles?.email}`)

    // 5. Enviar email usando el sistema existente
    const result = await sendEmail(disputeInfo.user_id, 'impugnacion_respuesta', customData)

    if (result.success) {
      console.log(`✅ API: Email de impugnación psicotécnica enviado exitosamente`)
      return NextResponse.json({
        success: true,
        emailId: result.emailId,
        disputeId: disputeId
      })
    } else if (result.cancelled) {
      // Usuario ha desactivado emails - no es un error, simplemente no se envía
      console.log(`⏭️ API: Email no enviado - usuario ha desactivado emails (${result.reason})`)
      return NextResponse.json({
        success: true,
        message: result.message || 'Email no enviado - usuario ha desactivado notificaciones',
        cancelled: true,
        disputeId: disputeId
      })
    } else {
      console.error(`❌ API: Error enviando email:`, result.error)
      return NextResponse.json({
        success: false,
        error: result.error || 'Error enviando email'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ API: Error en send-dispute-email/psychometric:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
