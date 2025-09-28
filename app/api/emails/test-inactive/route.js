import { NextResponse } from 'next/server'
import { detectInactiveUsers } from '../../../../lib/emails/emailService.server'

export async function GET() {
  try {
    console.log('🔍 API Diagnóstico: Verificando usuarios inactivos...')
    
    const inactiveUsers = await detectInactiveUsers()
    
    return NextResponse.json({
      success: true,
      count: inactiveUsers.length,
      users: inactiveUsers,
      message: `Encontrados ${inactiveUsers.length} usuarios inactivos`
    })
    
  } catch (error) {
    console.error('❌ Error verificando usuarios inactivos:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      count: 0,
      users: []
    }, { status: 500 })
  }
}
