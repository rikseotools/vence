// app/api/v2/admin/fraud/blocked/route.ts
// Usuarios bloqueados por límite de dispositivos. Tier admin.
// AGNÓSTICO (Fase C1): porta loadBlocked server-side (queries Drizzle + agregación verbatim).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
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

  const logs = rows(await db.execute(sql`
    SELECT user_id, error_message, created_at FROM validation_error_logs
    WHERE error_message ILIKE '%dispositivos conectados%'
      AND created_at >= now() - interval '7 days' AND user_id IS NOT NULL
  `))
  if (!logs.length) return NextResponse.json({ success: true, blocked: [] })

  const byUser = new Map<string, { count: number; last: string; devices: string }>()
  for (const log of logs) {
    if (!log.user_id) continue
    const entry = byUser.get(log.user_id) || { count: 0, last: '', devices: '' }
    entry.count++
    if (log.created_at > entry.last) {
      entry.last = log.created_at
      const match = (log.error_message || '').match(/\(([^)]+)\)/)
      if (match) entry.devices = match[1]
    }
    byUser.set(log.user_id, entry)
  }

  const userIds = [...byUser.keys()]
  const profiles = rows(await db.execute(sql`
    SELECT id, email, full_name, plan_type FROM user_profiles WHERE id = ANY(${userIds}::uuid[])
  `))
  const profileMap = new Map<string, any>(profiles.map(p => [p.id, p]))

  const blocked = [...byUser.entries()].map(([uid, entry]) => {
    const p = profileMap.get(uid)
    return {
      user_id: uid, email: p?.email || '?', full_name: p?.full_name || '',
      plan_type: p?.plan_type || 'free', existing_devices: entry.devices,
      block_count: entry.count, last_blocked: entry.last,
    }
  }).sort((a, b) => b.block_count - a.block_count)

  return NextResponse.json({ success: true, blocked })
}

export const GET = withErrorLogging('/api/v2/admin/fraud/blocked', _GET)
