// app/api/v2/admin/fraud/premium/route.ts
// Detección de premium compartido para /admin/fraudes. Tier admin.
// AGNÓSTICO (Fase C1): porta loadPremium server-side — queries Drizzle + la MISMA
// lógica de agregación del cliente (copiada verbatim) para no divergir en la
// detección. Datos de todos los usuarios → requireAdmin.
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

  const sessions = rows(await db.execute(sql`
    SELECT user_id, city, session_start, device_fingerprint
    FROM user_sessions
    WHERE city IS NOT NULL AND session_start >= now() - interval '7 days'
  `))
  if (!sessions.length) return NextResponse.json({ success: true, premium: [] })

  const premiumProfiles = rows(await db.execute(sql`
    SELECT id, email, full_name, plan_type FROM user_profiles
    WHERE plan_type = ANY(ARRAY['premium','premium_semester','trial'])
  `))
  if (!premiumProfiles.length) return NextResponse.json({ success: true, premium: [] })

  const premiumIds = new Set<string>(premiumProfiles.map(p => p.id))
  const profileMap = new Map<string, any>(premiumProfiles.map(p => [p.id, p]))
  const premiumUserIds = premiumProfiles.map(p => p.id)

  const userDevices = rows(await db.execute(sql`
    SELECT user_id, device_id, device_label FROM user_devices
    WHERE user_id = ANY(${pgUuidArray(premiumUserIds)})
  `))

  const deviceLabelMap = new Map<string, string>(
    userDevices.map(d => [d.device_id, d.device_label || d.device_id?.substring(0, 8)])
  )

  const byUser = new Map<string, { cities: Set<string>; devices: Set<string>; count: number; last: string }>()
  for (const s of sessions) {
    if (!premiumIds.has(s.user_id) || !s.city) continue
    const entry = byUser.get(s.user_id) || { cities: new Set(), devices: new Set(), count: 0, last: '' }
    entry.cities.add(s.city)
    if (s.device_fingerprint) {
      const label = deviceLabelMap.get(s.device_fingerprint) || s.device_fingerprint.substring(0, 8) + '...'
      entry.devices.add(label)
    }
    entry.count++
    if (s.session_start > entry.last) entry.last = s.session_start
    byUser.set(s.user_id, entry)
  }

  // Mismos device rows (la query del cliente allPremiumDevices era idéntica a userDevices)
  const devicesByUser = new Map<string, Set<string>>()
  for (const d of userDevices) {
    const set = devicesByUser.get(d.user_id) || new Set()
    set.add(d.device_label || d.device_id?.substring(0, 8))
    devicesByUser.set(d.user_id, set)
  }

  const premium: any[] = []
  for (const [uid, entry] of byUser) {
    const extraDevices = devicesByUser.get(uid)
    if (extraDevices) extraDevices.forEach(d => entry.devices.add(d))
    if (entry.devices.size < 3 && !(entry.devices.size >= 2 && entry.cities.size >= 3)) continue
    const profile = profileMap.get(uid)
    if (!profile) continue
    premium.push({
      user_id: uid, email: profile.email, full_name: profile.full_name || '',
      cities: [...entry.cities], devices: [...entry.devices],
      session_count: entry.count, last_session: entry.last,
    })
  }
  for (const [uid, devSet] of devicesByUser) {
    if (devSet.size < 3 || byUser.has(uid)) continue
    const profile = profileMap.get(uid)
    if (!profile) continue
    premium.push({
      user_id: uid, email: profile.email, full_name: profile.full_name || '',
      cities: [], devices: [...devSet], session_count: 0, last_session: '',
    })
  }
  premium.sort((a, b) => b.devices.length - a.devices.length)

  return NextResponse.json({ success: true, premium })
}

export const GET = withErrorLogging('/api/v2/admin/fraud/premium', _GET)
