import { NextResponse } from 'next/server'
import { detectUsersForEmails } from '../../../lib/emails/emailService.server'

export async function GET() {
  try {
    console.log('🔍 API: Detectando usuarios para emails...')
    
    const emailQueue = await detectUsersForEmails()
    
    console.log(`✅ API: ${emailQueue.length} usuarios en cola`)
    
    return NextResponse.json({
      success: true,
      queue: emailQueue,
      stats: {
        total: emailQueue.length
      }
    })
    
  } catch (error) {
    console.error('❌ API: Error detectando cola:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      queue: [],
      stats: { total: 0 }
    }, { status: 500 })
  }
}
