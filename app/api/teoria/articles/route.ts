// app/api/teoria/articles/route.ts
// GET: Lista de artículos de una ley
// Cacheable: los artículos cambian pocas veces al día.
import { NextRequest, NextResponse } from 'next/server'
import { fetchLawArticles } from '@/lib/teoriaFetchers'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const law = searchParams.get('law')

  if (!law) {
    return NextResponse.json({ error: 'Parámetro law requerido' }, { status: 400 })
  }

  const data = await fetchLawArticles(law)
  const res = NextResponse.json(data)

  // Cache permanente en CDN. El contenido de artículos casi nunca cambia.
  // Cuando cambia, se revalida manualmente con revalidateTag('teoria')
  // o redeploy. Ver docs/maintenance/cache-revalidation.md
  res.headers.set(
    'Cache-Control',
    'public, s-maxage=31536000, stale-while-revalidate=31536000',
  )
  return res
}

export const GET = withErrorLogging('/api/teoria/articles', _GET)
