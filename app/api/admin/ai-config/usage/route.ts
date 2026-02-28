// app/api/admin/ai-config/usage/route.ts
import { aiUsageQuerySchema } from '@/lib/api/admin-ai-usage/schemas'
import { getAiUsageStats } from '@/lib/api/admin-ai-usage'

export async function GET(request: Request) {
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
