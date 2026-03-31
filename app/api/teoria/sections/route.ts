// app/api/teoria/sections/route.ts
// GET: Secciones/títulos de una ley
import { NextRequest, NextResponse } from 'next/server'
import { fetchLawSections } from '@/lib/teoriaFetchers'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

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
  return NextResponse.json(data)
}

export const GET = withErrorLogging('/api/teoria/sections', _GET)
