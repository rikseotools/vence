// app/api/teoria/sections/route.ts
// GET: Secciones/títulos de una ley
// CDN cache: las secciones cambian solo cuando se sincroniza una ley desde el BOE.
import { NextRequest, NextResponse } from 'next/server'
import { fetchLawSections } from '@/lib/teoriaFetchers'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const CDN_CACHE_HEADER = 'public, s-maxage=86400, stale-while-revalidate=604800'

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const law = searchParams.get('law')

  if (!law) {
    return NextResponse.json({ error: 'Parámetro law requerido' }, { status: 400 })
  }

  const options: Record<string, string> = {}
  if (searchParams.get('lawId')) options.lawId = searchParams.get('lawId')!
  if (searchParams.get('lawName')) options.lawName = searchParams.get('lawName')!
  if (searchParams.get('lawShortName')) options.lawShortName = searchParams.get('lawShortName')!

  const data = await fetchLawSections(law, options)
  const response = NextResponse.json(data)
  response.headers.set('Cache-Control', CDN_CACHE_HEADER)
  return response
}

export const GET = withErrorLogging('/api/teoria/sections', _GET)
