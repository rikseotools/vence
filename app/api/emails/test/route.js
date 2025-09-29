import { NextResponse } from 'next/server'
import { testServerConnection } from '../../../lib/emails/emailService.server'

export async function GET() {
  try {
    console.log('🧪 API Test: Probando conexión server-only...')
    
    const result = await testServerConnection()
    
    console.log('✅ API Test resultado:', result)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('❌ API Test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
