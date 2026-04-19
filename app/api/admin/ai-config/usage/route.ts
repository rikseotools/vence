// app/api/admin/ai-config/usage/route.ts
import { NextRequest } from 'next/server'
import { aiUsageQuerySchema } from '@/lib/api/admin-ai-usage/schemas'
import { getAiUsageStats } from '@/lib/api/admin-ai-usage'
import { requireAdmin } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)

    const parsed = aiUsageQuerySchema.safeParse({
      days: searchParams.get('days') || '30',
      provider: searchParams.get('provider') || undefined
    })

    if (!parsed.success) {
      return Response.json(
        { success: false, error: 'Parámetros inválidos: ' + parsed.error.message },
        { status: 400 }
      )
    }

    const result = await getAiUsageStats(parsed.data.days, parsed.data.provider)
    return Response.json(result)

  } catch (error) {
    console.error('Error obteniendo uso de APIs:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/ai-config/usage', _GET)
