// app/api/unsubscribe/validate/route.js
import { NextResponse } from 'next/server'
import { validateUnsubscribeToken } from '../../../lib/emails/emailService.server'

// 🆕 AGREGADO: Maneja POST requests desde la página de unsubscribe
export async function POST(request) {
  try {
    const body = await request.json()
    const { token } = body
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token requerido'
      }, { status: 400 })
    }
    
    console.log('🔍 API: Validando token de unsubscribe via POST...', token.substring(0, 8) + '...')
    
    const tokenInfo = await validateUnsubscribeToken(token)
    
    if (!tokenInfo) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido, expirado o ya usado'
      }, { status: 400 })
    }
    
    console.log('✅ API: Token válido para usuario:', tokenInfo.email)
    
    return NextResponse.json({
      success: true,
      email: tokenInfo.email,
      user: {
        email: tokenInfo.email,
        name: tokenInfo.userProfile?.full_name || 'Usuario',
        emailType: tokenInfo.emailType
      }
    })
    
  } catch (error) {
    console.error('❌ Error validando token via POST:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}

// 🔄 MANTENIDO: Funcionalidad original GET (sin cambios)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token requerido'
      }, { status: 400 })
    }
    
    console.log('🔍 API: Validando token de unsubscribe via GET...', token.substring(0, 8) + '...')
    
    const tokenInfo = await validateUnsubscribeToken(token)
    
    if (!tokenInfo) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido, expirado o ya usado'
      }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      user: {
        email: tokenInfo.email,
        name: tokenInfo.userProfile?.full_name || 'Usuario',
        emailType: tokenInfo.emailType
      }
    })
    
  } catch (error) {
    console.error('❌ Error validando token via GET:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}