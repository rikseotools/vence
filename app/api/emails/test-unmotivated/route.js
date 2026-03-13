import { NextResponse } from 'next/server'
import { detectUnmotivatedUsers } from '@/lib/emails/emailService.server'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET() {
  try {
    console.log('🔍 API Diagnóstico: Verificando usuarios nuevos sin motivación...')
    
    const unmotivatedUsers = await detectUnmotivatedUsers()
    
    return NextResponse.json({
      success: true,
      count: unmotivatedUsers.length,
      users: unmotivatedUsers,
      message: `Encontrados ${unmotivatedUsers.length} usuarios nuevos que nunca empezaron`
    })
    
  } catch (error) {
    console.error('❌ Error verificando usuarios nuevos:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      count: 0,
      users: []
    }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/emails/test-unmotivated', _GET)
