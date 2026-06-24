// app/api/v2/admin/fraud/bots/route.ts
// Detección de bots (respuestas muy rápidas). Tier admin.
// AGNÓSTICO (Fase C1): porta loadBots server-side (queries Drizzle + agregación verbatim).
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

  // NOTA: el original filtraba por answered_at, columna INEXISTENTE en test_questions
  // (la detección de bots estaba rota → siempre vacía). Columna real: created_at.
  const fast = rows(await db.execute(sql`
    SELECT user_id, time_spent_seconds, created_at FROM test_questions
    WHERE time_spent_seconds > 0 AND created_at >= now() - interval '7 days'
  `))
  if (!fast.length) return NextResponse.json({ success: true, bots: [] })

  const byUser = new Map<string, { total: number; count: number; last: string }>()
  for (const r of fast) {
    if (!r.user_id) continue
    const entry = byUser.get(r.user_id) || { total: 0, count: 0, last: '' }
    entry.total += r.time_spent_seconds
    entry.count++
    if (r.created_at > entry.last) entry.last = r.created_at
    byUser.set(r.user_id, entry)
  }

  const suspects = [...byUser.entries()]
    .map(([uid, e]) => ({ uid, avg: e.total / e.count, count: e.count, last: e.last }))
    .filter(s => s.avg < 3 && s.count >= 10)
    .sort((a, b) => a.avg - b.avg)
  if (!suspects.length) return NextResponse.json({ success: true, bots: [] })

  const profiles = rows(await db.execute(sql`
    SELECT id, email, full_name FROM user_profiles WHERE id = ANY(${suspects.map(s => s.uid)}::uuid[])
  `))
  const profileMap = new Map<string, any>(profiles.map(p => [p.id, p]))

  const bots = suspects.map(s => {
    const p = profileMap.get(s.uid)
    return {
      user_id: s.uid, email: p?.email || '?', full_name: p?.full_name || '',
      avg_seconds: Math.round(s.avg * 10) / 10, total_answers: s.count, last_answer: s.last,
    }
  })

  return NextResponse.json({ success: true, bots })
}

export const GET = withErrorLogging('/api/v2/admin/fraud/bots', _GET)
