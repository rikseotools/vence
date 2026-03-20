// app/api/v2/hot-articles/route.ts
// Batch lookup of official exam data for articles, filtered by oposicion
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getMultipleArticlesOfficialExamData } from '@/lib/api/hot-articles'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const requestSchema = z.object({
  articleNumbers: z.array(z.string()).min(1).max(200),
  lawShortName: z.string().min(1),
  userOposicion: z.string().nullable().optional(),
})

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const parsed = requestSchema.safeParse({
    articleNumbers: searchParams.get('articleNumbers')?.split(',').filter(Boolean) ?? [],
    lawShortName: searchParams.get('lawShortName') ?? '',
    userOposicion: searchParams.get('userOposicion') || null,
  })

  if (!parsed.success) {
    return Response.json({ error: 'Parámetros inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { articleNumbers, lawShortName, userOposicion } = parsed.data

  const data = await getMultipleArticlesOfficialExamData(articleNumbers, lawShortName, userOposicion ?? null)

  return Response.json(data)
}

export const GET = withErrorLogging('/api/v2/hot-articles', _GET)
