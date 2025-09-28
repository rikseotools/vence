import { NextResponse } from 'next/server'
import { runEmailCampaign } from '../../../../lib/emails/emailService.server'

export async function POST() {
  try {
    console.log('🚀 API: Ejecutando campaña automática...')
    
    const result = await runEmailCampaign()
    
    console.log('✅ API: Campaña automática completada:', result)
    
    return NextResponse.json({
      success: true,
      ...result
    })
    
  } catch (error) {
    console.error('❌ API: Error en campaña automática:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      total: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      details: []
    }, { status: 500 })
  }
}
