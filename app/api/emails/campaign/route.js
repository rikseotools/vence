import { NextResponse } from 'next/server'
import { runEmailCampaign } from '@/lib/emails/emailService.server'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST() {
  try {
    console.log('🚀 API: Ejecutando campaña de emails...')
    
    const result = await runEmailCampaign()
    
    console.log('✅ API: Campaña completada:', result)
    
    return NextResponse.json({
      success: true,
      ...result
    })
    
  } catch (error) {
    console.error('❌ API: Error en campaña:', error)
    
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

export const POST = withErrorLogging('/api/emails/campaign', _POST)
