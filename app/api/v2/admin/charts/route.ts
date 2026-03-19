// app/api/v2/admin/charts/route.ts - Endpoint unificado para charts de admin
// Reemplaza 28 queries secuenciales del cliente por 2 queries SQL paralelas
import { NextRequest, NextResponse } from 'next/server'
import { getActivityChartData, getRegistrationsChartData, chartRequestSchema } from '@/lib/api/admin-charts'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parseResult = chartRequestSchema.safeParse({
      days: parseInt(searchParams.get('days') || '14'),
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parseResult.error.issues },
        { status: 400 },
      )
    }

    const { days } = parseResult.data

    // 2 queries SQL paralelas con timeout de 15s
    const timeoutMs = 15000
    const withTimeout = <T>(promise: Promise<T>, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ])

    const [activity, registrations] = await Promise.all([
      withTimeout(getActivityChartData(days), 'activity'),
      withTimeout(getRegistrationsChartData(days), 'registrations'),
    ])

    return NextResponse.json({ activity, registrations })
  } catch (error) {
    console.error('[API/v2/admin/charts] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error loading chart data' },
      { status: 500 },
  }
}

export const GET = withErrorLogging('/api/v2/admin/charts', _GET)
