// app/api/v2/admin/conversion-stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getConversionStats, conversionStatsRequestSchema } from '@/lib/api/admin-conversion-stats'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parseResult = conversionStatsRequestSchema.safeParse({
      days: parseInt(searchParams.get('days') || '7'),
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parseResult.error.issues },
        { status: 400 },
      )
    }

    const data = await getConversionStats(parseResult.data.days)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API/v2/admin/conversion-stats] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    )
  }
}
