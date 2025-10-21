import { NextResponse } from 'next/server'
import { sendSupportResponseEmail } from '../../../lib/emails/supportEmailService'

export async function POST(request) {
  try {
    const { userId, adminMessage, conversationId } = await request.json()

    if (!userId || !adminMessage || !conversationId) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    const result = await sendSupportResponseEmail(userId, adminMessage, conversationId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ Error en API send-support-email:', error)
    return NextResponse.json(
      { sent: false, reason: 'api_error', error: error.message },
      { status: 500 }
    )
  }
}