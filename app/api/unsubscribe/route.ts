// app/api/unsubscribe/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { processUnsubscribeByToken } from '@/lib/emails/emailService.server'

export async function POST(request: NextRequest) {
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
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ API Unsubscribe: Error interno:', (error as Error).message)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 })
  }
}
