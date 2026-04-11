// app/api/unsubscribe/validate/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { validateUnsubscribeToken } from '@/lib/emails/emailService.server'
import { EMAIL_TYPE_TO_CATEGORY } from '@/lib/api/emails/schemas'
import type { EmailType } from '@/lib/api/emails/schemas'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
function getCategory(emailType: string): string {
  return EMAIL_TYPE_TO_CATEGORY[emailType as EmailType] ?? 'marketing'
}

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body as { token?: string }

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token requerido',
        errorCode: 'missing_token',
      }, { status: 400 })
    }

    const tokenResult = await validateUnsubscribeToken(token)

    if (!tokenResult.ok) {
      // db_error → 500 critical, not_found → 400 info
      const status = tokenResult.code === 'db_error' ? 500 : 400
      return NextResponse.json({
        success: false,
        error: tokenResult.error,
        errorCode: tokenResult.code,
      }, { status })
    }

    return NextResponse.json({
      success: true,
      email: tokenResult.email,
      user: {
        email: tokenResult.email,
        name: tokenResult.userProfile?.full_name || 'Usuario',
        emailType: tokenResult.emailType,
        category: getCategory(tokenResult.emailType),
      }
    })
  } catch (error) {
    console.error('❌ [API/unsubscribe/validate POST] Unhandled exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      errorCode: 'internal_error',
    }, { status: 500 })
  }
}

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token requerido',
        errorCode: 'missing_token',
      }, { status: 400 })
    }

    const tokenResult = await validateUnsubscribeToken(token)

    if (!tokenResult.ok) {
      const status = tokenResult.code === 'db_error' ? 500 : 400
      return NextResponse.json({
        success: false,
        error: tokenResult.error,
        errorCode: tokenResult.code,
      }, { status })
    }

    return NextResponse.json({
      success: true,
      user: {
        email: tokenResult.email,
        name: tokenResult.userProfile?.full_name || 'Usuario',
        emailType: tokenResult.emailType,
        category: getCategory(tokenResult.emailType),
      }
    })
  } catch (error) {
    console.error('❌ [API/unsubscribe/validate GET] Unhandled exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      errorCode: 'internal_error',
    }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/unsubscribe/validate', _POST)
export const GET = withErrorLogging('/api/unsubscribe/validate', _GET)
