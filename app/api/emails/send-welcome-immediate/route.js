import { NextResponse } from 'next/server'
import { sendWelcomeEmailImmediate } from '@/lib/emails/emailService.server'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST(request) {
  try {
    const body = await request.json()
    const { userId } = body
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId requerido'
      }, { status: 400 })
    }
    
    console.log('📧 API: Enviando email de bienvenida inmediato...')
    
    const result = await sendWelcomeEmailImmediate(userId)
    
    console.log('✅ API: Email de bienvenida procesado:', result)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('❌ API: Error enviando email de bienvenida:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/emails/send-welcome-immediate', _POST)
