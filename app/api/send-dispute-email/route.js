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

// Obtener información del usuario y la disputa
async function getDisputeInfo(disputeId) {
  try {
    const supabase = getSupabase()
    
    console.log(`🔍 API: Buscando disputa con ID: ${disputeId}`)
    
    // Primero obtener la disputa básica
    const { data: disputeData, error: disputeError } = await supabase
      .from('question_disputes')
      .select('*')
      .eq('id', disputeId)
      .single()

    console.log(`🔍 API: Dispute basic data:`, disputeData)
    console.log(`🔍 API: Dispute error:`, disputeError)

    if (disputeError || !disputeData) {
      throw new Error('Disputa no encontrada')
    }

    // Luego obtener user info
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', disputeData.user_id)
      .single()

    console.log(`🔍 API: User data:`, userData)

    // Y la pregunta
    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select('question_text')
      .eq('id', disputeData.question_id)
      .single()

    console.log(`🔍 API: Question data:`, questionData)

    const data = {
      ...disputeData,
      user_profiles: userData,
      questions: questionData
    }

    console.log(`🔍 API: Final combined data:`, data)
    return data
  } catch (error) {
    console.error('Error obteniendo información de la disputa:', error)
    return null
  }
}

export async function POST(request) {
  try {
    console.log(`📧 API: Iniciando envío de email de impugnación`)
    
    const body = await request.json()
    const { disputeId } = body

    if (!disputeId) {
      return NextResponse.json({ 
        success: false, 
        error: 'disputeId es requerido' 
      }, { status: 400 })
    }

    console.log(`📧 API: Procesando disputa ID: ${disputeId}`)

    // 1. Obtener información de la disputa
    const disputeInfo = await getDisputeInfo(disputeId)
    if (!disputeInfo) {
      return NextResponse.json({ 
        success: false, 
        error: 'Disputa no encontrada' 
      }, { status: 404 })
    }

    console.log(`📧 API: Disputa encontrada para usuario: ${disputeInfo.user_profiles.email}`)
    console.log(`📧 API: Status: ${disputeInfo.status}`)

    // 2. Crear URLs
    const disputeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'}/soporte?tab=impugnaciones&dispute_id=${disputeId}`
    const unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'}/perfil`

    // 3. Preparar datos del email
    const customData = {
      to: disputeInfo.user_profiles.email,
      userName: disputeInfo.user_profiles.full_name || 'Usuario',
      status: disputeInfo.status,
      adminResponse: disputeInfo.admin_response,
      questionText: disputeInfo.questions?.question_text,
      disputeUrl: disputeUrl,
      unsubscribeUrl: unsubscribeUrl
    }

    console.log(`📧 API: Enviando email a: ${disputeInfo.user_profiles.email}`)
    console.log(`📧 API: Status: ${disputeInfo.status}`)
    console.log(`📧 API: Tiene admin_response: ${!!disputeInfo.admin_response}`)

    // 4. Enviar email usando el sistema existente
    const result = await sendEmail(disputeInfo.user_id, 'impugnacion_respuesta', customData)

    if (result.success) {
      console.log(`✅ API: Email de impugnación enviado exitosamente`)
      return NextResponse.json({ 
        success: true, 
        emailId: result.emailId,
        disputeId: disputeId
      })
    } else {
      console.error(`❌ API: Error enviando email de impugnación:`, result.error)
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Error enviando email'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ API: Error en send-dispute-email:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}