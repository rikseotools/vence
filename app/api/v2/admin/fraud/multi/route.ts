// app/api/v2/admin/fraud/multi/route.ts
// Detección de multicuentas (dispositivo compartido por ≥2 usuarios). Tier admin.
// AGNÓSTICO (Fase C1): porta loadMulti server-side (queries Drizzle + agregación verbatim).
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

  const devices = rows(await db.execute(sql`
    SELECT device_id, device_label, user_id, first_seen_at, last_seen_at
    FROM user_devices WHERE last_seen_at >= now() - interval '30 days'
  `))
  if (!devices.length) return NextResponse.json({ success: true, multi: [] })

  const byDevice = new Map<string, { label: string; users: Set<string>; first: string; last: string }>()
  for (const d of devices) {
    const entry = byDevice.get(d.device_id) || { label: d.device_label || '', users: new Set<string>(), first: d.first_seen_at, last: d.last_seen_at }
    entry.users.add(d.user_id)
    if (d.first_seen_at < entry.first) entry.first = d.first_seen_at
    if (d.last_seen_at > entry.last) entry.last = d.last_seen_at
    byDevice.set(d.device_id, entry)
  }

  const sharedDevices = [...byDevice.entries()].filter(([, e]) => e.users.size >= 2)
  if (!sharedDevices.length) return NextResponse.json({ success: true, multi: [] })

  const allUserIds = [...new Set(sharedDevices.flatMap(([, e]) => [...e.users]))]
  const profiles = rows(await db.execute(sql`
    SELECT id, email, full_name, plan_type FROM user_profiles WHERE id = ANY(${pgUuidArray(allUserIds)})
  `))
  const profileMap = new Map<string, any>(profiles.map(p => [p.id, p]))

  const usage = rows(await db.execute(sql`
    SELECT user_id, questions_answered FROM daily_question_usage
    WHERE user_id = ANY(${pgUuidArray(allUserIds)}) AND usage_date = CURRENT_DATE
  `))
  const usageMap = new Map<string, number>(usage.map(u => [u.user_id, u.questions_answered]))

  const multi = sharedDevices.map(([deviceId, entry]) => ({
    device_id: deviceId, device_label: entry.label, first_seen: entry.first, last_seen: entry.last,
    accounts: [...entry.users].map(uid => {
      const p = profileMap.get(uid)
      return { user_id: uid, email: p?.email || '?', full_name: p?.full_name || '', plan_type: p?.plan_type || 'free', questions_today: usageMap.get(uid) || 0 }
    }),
  }))
  multi.sort((a, b) => b.accounts.length - a.accounts.length)

  return NextResponse.json({ success: true, multi })
}

export const GET = withErrorLogging('/api/v2/admin/fraud/multi', _GET)
