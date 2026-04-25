// app/api/teoria/articles/route.ts
// GET: Lista de artículos de una ley
// Cache permanente via unstable_cache (tag 'teoria').
// Revalidar manualmente: revalidateTag('teoria')
// Ver docs/maintenance/cache-revalidation.md
import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { fetchLawArticles } from '@/lib/teoriaFetchers'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const getCachedArticles = unstable_cache(
  async (lawSlug: string) => fetchLawArticles(lawSlug),
  ['teoria-articles-list'],
  { revalidate: false, tags: ['teoria'] },
)

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const law = searchParams.get('law')

  if (!law) {
    return NextResponse.json({ error: 'Parámetro law requerido' }, { status: 400 })
  }

  const data = await getCachedArticles(law)
  return NextResponse.json(data)
}

export const GET = withErrorLogging('/api/teoria/articles', _GET)
