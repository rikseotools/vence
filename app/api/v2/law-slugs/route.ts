// app/api/v2/law-slugs/route.ts
// Endpoint público que devuelve el mapping completo slug ↔ shortName + info.
// Usado por LawSlugContext en client components.
// Cache agresivo: las leyes cambian muy raramente.
import { getSlugMappingForApi } from '@/lib/api/laws'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET() {
  const mappings = await getSlugMappingForApi()

  return Response.json(
    { success: true, mappings, count: mappings.length },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  )
}

export const GET = withErrorLogging('/api/v2/law-slugs', _GET)
