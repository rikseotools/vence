import { NextResponse } from 'next/server'
import { sendSupportResponseEmail } from '../../../lib/emails/supportEmailService'

export async function POST(request) {
  try {
    console.log('🚀 API send-support-email: Recibida petición POST')
    
    const { userId, adminMessage, conversationId } = await request.json()
    console.log('📧 API: Parámetros recibidos:', { userId, adminMessage: adminMessage?.substring(0, 50) + '...', conversationId })

    if (!userId || !adminMessage || !conversationId) {
      console.log('❌ API: Faltan parámetros requeridos')
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    console.log('📧 API: Llamando a sendSupportResponseEmail...')
    const result = await sendSupportResponseEmail(userId, adminMessage, conversationId)
    console.log('📧 API: Resultado del servicio:', result)

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ Error en API send-support-email:', error)
    return NextResponse.json(
      { sent: false, reason: 'api_error', error: error.message },
      { status: 500 }
    )
  }
}