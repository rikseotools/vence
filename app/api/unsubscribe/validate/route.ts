// app/api/unsubscribe/validate/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { validateUnsubscribeToken } from '@/lib/emails/emailService.server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body as { token?: string }

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token requerido'
      }, { status: 400 })
    }

    const tokenInfo = await validateUnsubscribeToken(token)

    if (!tokenInfo) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido, expirado o ya usado'
      }, { status: 400 })
    }

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token requerido'
      }, { status: 400 })
    }

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
