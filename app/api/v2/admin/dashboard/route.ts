// app/api/v2/admin/dashboard/route.ts - Dashboard admin con Drizzle
// Reemplaza 13 queries secuenciales del cliente por ~10 queries paralelas en servidor
import { NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/api/admin-dashboard'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET() {
  try {
    const data = await getDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API/v2/admin/dashboard] Error:', error)
    return NextResponse.json(
      { error: 'Error loading dashboard data' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/v2/admin/dashboard', _GET)
