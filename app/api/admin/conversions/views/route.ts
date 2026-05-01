// app/api/admin/conversions/views/route.ts
// Devuelve conversion_time_analysis + admin_upgrade_message_stats — solo admins.
// Reemplaza el acceso directo desde el browser a estas views
// (app/admin/conversiones/page.tsx), que dependía de SECURITY DEFINER para
// bypassar RLS de conversion_events / upgrade_messages / impressions.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const [timeAnalysisRes, abStatsRes] = await Promise.all([
    admin.supabase.from('conversion_time_analysis').select('*'),
    admin.supabase
      .from('admin_upgrade_message_stats')
      .select('*')
      .order('total_impressions', { ascending: false }),
  ])

  if (timeAnalysisRes.error) {
    console.error('❌ [admin/conversions/views] time_analysis:', timeAnalysisRes.error.message)
  }
  if (abStatsRes.error) {
    console.error('❌ [admin/conversions/views] ab_stats:', abStatsRes.error.message)
  }

  return NextResponse.json({
    timeAnalysis: timeAnalysisRes.data ?? [],
    abStats: abStatsRes.data ?? [],
  })
}

export const GET = withErrorLogging('/api/admin/conversions/views', _GET)
