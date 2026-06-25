// app/api/v2/admin/fraud/scripts/route.ts
// Detección de scripts/curl (uso sin dispositivo registrado). Tier admin.
// AGNÓSTICO (Fase C1): porta loadScripts server-side (queries Drizzle + agregación verbatim).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { pgUuidArray } from '@/lib/api/sqlArrays'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 25

function rows(r: unknown): any[] {
  return (Array.isArray(r) ? r : (r as { rows?: unknown[] }).rows || []) as any[]
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const db = getAdminDb()

  const recentUsage = rows(await db.execute(sql`
    SELECT user_id, questions_answered, usage_date FROM daily_question_usage
    WHERE usage_date >= (CURRENT_DATE - 7)
  `))
  if (!recentUsage.length) return NextResponse.json({ success: true, scripts: [] })

  const usageUserIds = [...new Set(recentUsage.map(u => u.user_id))]
  const deviceUsers = rows(await db.execute(sql`
    SELECT user_id FROM user_devices WHERE user_id = ANY(${pgUuidArray(usageUserIds)})
  `))
  const usersWithDevices = new Set<string>(deviceUsers.map(d => d.user_id))

  const suspectIds = usageUserIds.filter(id => !usersWithDevices.has(id))
  if (!suspectIds.length) return NextResponse.json({ success: true, scripts: [] })

  const totalByUser = new Map<string, { total: number; last: string }>()
  for (const u of recentUsage) {
    if (!suspectIds.includes(u.user_id)) continue
    const entry = totalByUser.get(u.user_id) || { total: 0, last: '' }
    entry.total += u.questions_answered
    if (u.usage_date > entry.last) entry.last = u.usage_date
    totalByUser.set(u.user_id, entry)
  }

  const profiles = rows(await db.execute(sql`
    SELECT id, email, full_name, plan_type FROM user_profiles WHERE id = ANY(${pgUuidArray(suspectIds)})
  `))
  const profileMap = new Map<string, any>(profiles.map(p => [p.id, p]))

  const scripts = [...totalByUser.entries()].map(([uid, entry]) => {
    const p = profileMap.get(uid)
    return {
      user_id: uid, email: p?.email || '?', full_name: p?.full_name || '',
      plan_type: p?.plan_type || 'free', questions_total: entry.total, last_usage: entry.last,
    }
  }).sort((a, b) => b.questions_total - a.questions_total)

  return NextResponse.json({ success: true, scripts })
}

export const GET = withErrorLogging('/api/v2/admin/fraud/scripts', _GET)
