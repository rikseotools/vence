// app/api/topic-review/update-status/route.ts
import { NextRequest } from 'next/server'
import { safeParseUpdateStatus, updateQuestionStatus } from '@/lib/api/topic-review'
import { requireAdmin } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin.ok) return admin.response

    const body = await request.json()
    const parsed = safeParseUpdateStatus(body)

    if (!parsed.success) {
      return Response.json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Datos inválidos',
      }, { status: 400 })
    }

    const { questionId, status } = parsed.data
    const result = await updateQuestionStatus(questionId, status, admin.user.id)

    if (!result.success) {
      return Response.json(result, { status: 500 })
    }

    return Response.json(result)
  } catch (error) {
    console.error('Error en update-status:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/topic-review/update-status', _POST)
