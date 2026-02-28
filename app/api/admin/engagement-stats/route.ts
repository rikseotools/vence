// app/api/admin/engagement-stats/route.ts - API para estadísticas de engagement (MAU)
import { NextResponse } from 'next/server'
import { getEngagementStats } from '@/lib/api/admin-engagement-stats'

export async function GET() {
  try {
    const result = await getEngagementStats()
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/admin/engagement-stats] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
