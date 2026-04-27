// app/api/teoria/articles/route.ts
// GET: Lista de artículos de una ley
// Cache: unstable_cache (Data Cache, tag 'teoria') + CDN cache (Edge Network).
// unstable_cache se pierde en cada deploy de Vercel; el CDN cache (s-maxage)
// sobrevive deploys y evita timeouts por cold-miss en la primera request.
// Revalidar manualmente: revalidateTag('teoria') + purge CDN via /api/admin/purge-cache
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

// CDN cache: 24h fresh, 7 días stale-while-revalidate.
// El contenido de artículos cambia solo cuando se sincroniza una ley desde el BOE
// (manual, via /admin/monitoreo). stale-while-revalidate asegura que los usuarios
// siempre reciben respuesta inmediata incluso si el cache expiró.
const CDN_CACHE_HEADER = 'public, s-maxage=86400, stale-while-revalidate=604800'

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const law = searchParams.get('law')

  if (!law) {
    return NextResponse.json({ error: 'Parámetro law requerido' }, { status: 400 })
  }

  const data = await getCachedArticles(law)
  const response = NextResponse.json(data)
  response.headers.set('Cache-Control', CDN_CACHE_HEADER)
  return response
}

export const GET = withErrorLogging('/api/teoria/articles', _GET)
