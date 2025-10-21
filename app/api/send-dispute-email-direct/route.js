import { NextResponse } from 'next/server'
import { sendEmail } from '../../../lib/emails/emailService.server.js'
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

// Obtener información adicional del usuario y pregunta (que no está en el trigger)
async function getAdditionalInfo(userId, questionId) {
  try {
    const supabase = getSupabase()
    
    // Obtener user info
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    console.log(`🔍 API-DIRECT: User data:`, userData)

    // Obtener question info
    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select('question_text')
      .eq('id', questionId)
      .single()

    console.log(`🔍 API-DIRECT: Question data:`, questionData)

    return {
      user_profiles: userData,
      questions: questionData
    }
  } catch (error) {
    console.error('Error obteniendo información adicional:', error)
    return null
  }
}

export async function POST(request) {
  try {
    console.log(`📧 API-DIRECT: Iniciando envío de email de impugnación (datos directos)`)
    
    const body = await request.json()
    const { disputeId, status, adminResponse, resolvedAt, userId, questionId } = body

    console.log(`📧 API-DIRECT: Datos recibidos:`, {
      disputeId,
      status,
      hasAdminResponse: !!adminResponse,
      resolvedAt,
      userId,
      questionId
    })

    if (!disputeId || !userId || !questionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Faltan datos requeridos' 
      }, { status: 400 })
    }

    // Solo enviar email si hay respuesta del admin
    if (!adminResponse || !adminResponse.trim()) {
      console.log(`⏭️ API-DIRECT: No hay admin_response, saltando envío de email`)
      return NextResponse.json({ 
        success: true, 
        message: 'Email no enviado - sin respuesta del admin',
        disputeId: disputeId
      })
    }

    // Obtener información adicional del usuario y pregunta
    const additionalInfo = await getAdditionalInfo(userId, questionId)
    if (!additionalInfo) {
      return NextResponse.json({ 
        success: false, 
        error: 'Error obteniendo información adicional' 
      }, { status: 500 })
    }

    console.log(`📧 API-DIRECT: Enviando email a: ${additionalInfo.user_profiles.email}`)
    console.log(`📧 API-DIRECT: Status: "${status}"`)
    console.log(`📧 API-DIRECT: Admin response preview: "${adminResponse?.substring(0, 50)}..."`)

    // Crear URLs
    // Siempre usar URL de producción en emails
    const baseUrl = 'https://www.vence.es'
    const disputeUrl = `${baseUrl}/soporte?tab=impugnaciones&dispute_id=${disputeId}`
    const unsubscribeUrl = `${baseUrl}/perfil`

    // Preparar datos del email
    const customData = {
      to: additionalInfo.user_profiles.email,
      userName: additionalInfo.user_profiles.full_name || 'Usuario',
      status: status,
      adminResponse: adminResponse,
      questionText: additionalInfo.questions?.question_text,
      disputeUrl: disputeUrl,
      unsubscribeUrl: unsubscribeUrl
    }

    // Enviar email usando el sistema existente
    const result = await sendEmail(userId, 'impugnacion_respuesta', customData)

    if (result.success) {
      console.log(`✅ API-DIRECT: Email de impugnación enviado exitosamente`)
      return NextResponse.json({ 
        success: true, 
        emailId: result.emailId,
        disputeId: disputeId
      })
    } else {
      console.error(`❌ API-DIRECT: Error enviando email de impugnación:`, result.error)
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Error enviando email'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ API-DIRECT: Error en send-dispute-email-direct:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}