// app/api/unsubscribe/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { processUnsubscribeByToken } from '@/lib/emails/emailService.server'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, unsubscribeAll = false, specificTypes = null, categories = null } = body as {
      token?: string
      unsubscribeAll?: boolean
      specificTypes?: string[] | null
      categories?: string[] | null
    }

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token requerido'
      }, { status: 400 })
    }

    const result = await processUnsubscribeByToken(token, specificTypes, unsubscribeAll, categories)

    if (!result.success) {
      // db_error / internal_error → 500 para que withErrorLogging los marque como critical
      // invalid_token → 400 (error de cliente esperado)
      const status = result.errorCode === 'db_error' || result.errorCode === 'internal_error' ? 500 : 400
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/unsubscribe] Unhandled exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      errorCode: 'internal_error',
    }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/unsubscribe', _POST)
