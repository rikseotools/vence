// app/api/admin/oep-signals/route.ts
// GET: listar señales (con filtro de status). POST: review (apply/dismiss).
import { NextRequest, NextResponse } from 'next/server'
import { listSignals, reviewSignal } from '@/lib/api/oep-signals/queries'
import { safeParseReviewSignal, signalStatusOptions, type SignalStatus } from '@/lib/api/oep-signals/schemas'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 15

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const scopeParam = searchParams.get('scope')
    const limitParam = searchParams.get('limit')

    const status: SignalStatus | undefined = statusParam && (signalStatusOptions as readonly string[]).includes(statusParam)
      ? (statusParam as SignalStatus)
      : undefined
    const scope: 'all' | 'known' | 'regional' = scopeParam === 'known' || scopeParam === 'regional' ? scopeParam : 'all'
    const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10) || 100)) : 100

    const result = await listSignals({ status, scope, limit })
    return NextResponse.json(result)
  } catch (err) {
    console.error('❌ [API/admin/oep-signals] GET error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}

async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const body = await request.json()
    const validation = safeParseReviewSignal(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const result = await reviewSignal(validation.data)
    if (!result.success) {
      return NextResponse.json(result, { status: result.error === 'Señal no encontrada' ? 404 : 500 })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('❌ [API/admin/oep-signals] POST error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/oep-signals', _GET)
export const POST = withErrorLogging('/api/admin/oep-signals', _POST)
