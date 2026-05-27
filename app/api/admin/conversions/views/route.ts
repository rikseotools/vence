// app/api/admin/conversions/views/route.ts
// Devuelve conversion_time_analysis + admin_upgrade_message_stats — solo admins.
// Reemplaza el acceso directo desde el browser a estas views
// (app/admin/conversiones/page.tsx), que dependía de SECURITY DEFINER para
// bypassar RLS de conversion_events / upgrade_messages / impressions.

import { NextRequest, NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { conversionTimeAnalysis, adminUpgradeMessageStats } from '@/db/schema'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  // Migración 27/05/2026 (Fase 3 strangler fig agnosticismo-supabase):
  // de admin.supabase.from(view).select() a Drizzle pgView typed query.
  // Sigue siendo bypass-RLS (getAdminDb usa la misma service role), pero
  // ahora portable a cualquier Postgres puro (RDS, Neon, etc.).
  const db = getAdminDb()
  // Try/catch alrededor de Promise.all para conservar el patrón "no rompe
  // si una falla" del original (que loggeaba pero seguía con la otra).
  const [timeAnalysisRes, abStatsRes] = await Promise.allSettled([
    db.select().from(conversionTimeAnalysis),
    db.select()
      .from(adminUpgradeMessageStats)
      .orderBy(desc(adminUpgradeMessageStats.totalImpressions)),
  ])

  if (timeAnalysisRes.status === 'rejected') {
    console.error('❌ [admin/conversions/views] time_analysis:', timeAnalysisRes.reason)
  }
  if (abStatsRes.status === 'rejected') {
    console.error('❌ [admin/conversions/views] ab_stats:', abStatsRes.reason)
  }

  return NextResponse.json({
    timeAnalysis: timeAnalysisRes.status === 'fulfilled' ? timeAnalysisRes.value : [],
    abStats: abStatsRes.status === 'fulfilled' ? abStatsRes.value : [],
  })
}

export const GET = withErrorLogging('/api/admin/conversions/views', _GET)
