// app/api/admin/newsletters/template-stats/route.ts
import { NextResponse } from 'next/server'
import { getTemplateStats } from '@/lib/api/newsletters'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET() {
  try {
    const result = await getTemplateStats()
    return NextResponse.json(result)

  } catch (error) {
    console.error('Error en template-stats API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/newsletters/template-stats', _GET)
