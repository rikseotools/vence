// lib/api/subscription/history.ts
// Historial (hitos) de la suscripción de un usuario, para que VEA en /perfil todo lo que ha hecho.
// READ-ONLY y user-scoped: el endpoint deriva el userId del TOKEN (nunca del cliente → anti-IDOR).
//
// Fuentes ricas y COMPLETAS — funciona aunque NO tenga suscripción activa ahora (free/cancelado):
//   - plan_type_audit_log : cada cambio free↔premium (te hiciste premium / volviste a free).
//   - observable_events   : cancelaciones / reactivaciones (subscription_*).
//   - user_subscriptions  : estado ACTUAL (plan, hasta cuándo, si está cancelada a fin de periodo).
// (El buildTimeline viejo dependía de la sub de Stripe activa → invisible para ex-suscriptores.)

import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export type SubHistoryEventType =
  | 'became_premium' | 'became_free' | 'cancelled' | 'reactivated' | 'cancelled_unpaid'

export interface SubHistoryEvent {
  type: SubHistoryEventType
  date: string // YYYY-MM-DD
  detail?: string // p.ej. la fecha de fin de periodo de una cancelación
}

export interface SubscriptionHistory {
  isPremium: boolean
  current: {
    status: string
    planType: string | null
    periodEnd: string | null
    cancelAtPeriodEnd: boolean
  } | null
  timeline: SubHistoryEvent[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsOf(res: unknown): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Array.isArray(res) ? res : ((res as any)?.rows ?? [])
}

const day = (v: unknown): string => new Date(v as string).toISOString().substring(0, 10)

export async function getSubscriptionHistory(userId: string): Promise<SubscriptionHistory> {
  const db = getReadDb()
  const events: SubHistoryEvent[] = []

  // 1. plan_type_audit_log → became_premium / became_free
  const auditRes = await db.execute(sql`
    SELECT old_plan_type, new_plan_type, changed_at
    FROM plan_type_audit_log WHERE user_id = ${userId} ORDER BY changed_at ASC`)
  for (const r of rowsOf(auditRes)) {
    const np = String(r.new_plan_type || '')
    const op = String(r.old_plan_type || '')
    if (np === 'premium' && op !== 'premium') events.push({ type: 'became_premium', date: day(r.changed_at) })
    else if (np === 'free' && op === 'premium') events.push({ type: 'became_free', date: day(r.changed_at) })
  }

  // 2. observable_events → cancelaciones / reactivaciones
  const evRes = await db.execute(sql`
    SELECT event_type, metadata, created_at
    FROM observable_events
    WHERE user_id = ${userId}
      AND event_type IN ('subscription_cancelled_at_period_end','subscription_reactivated','subscription_force_canceled_past_due')
    ORDER BY created_at ASC`)
  for (const r of rowsOf(evRes)) {
    const date = day(r.created_at)
    const meta = (r.metadata || {}) as Record<string, unknown>
    if (r.event_type === 'subscription_reactivated') events.push({ type: 'reactivated', date })
    else if (r.event_type === 'subscription_force_canceled_past_due') events.push({ type: 'cancelled_unpaid', date })
    else events.push({ type: 'cancelled', date, detail: meta.periodEnd ? day(meta.periodEnd) : undefined })
  }

  // 3. estado ACTUAL (última fila de user_subscriptions)
  const curRes = await db.execute(sql`
    SELECT status, plan_type, current_period_end, cancel_at_period_end
    FROM user_subscriptions WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1`)
  const curRow = rowsOf(curRes)[0]
  const current = curRow
    ? {
        status: String(curRow.status),
        planType: curRow.plan_type ? String(curRow.plan_type) : null,
        periodEnd: curRow.current_period_end ? day(curRow.current_period_end) : null,
        cancelAtPeriodEnd: !!curRow.cancel_at_period_end,
      }
    : null

  // plan_type del perfil = fuente de verdad de si es premium AHORA
  const planRes = await db.execute(sql`SELECT plan_type FROM user_profiles WHERE id = ${userId} LIMIT 1`)
  const isPremium = String(rowsOf(planRes)[0]?.plan_type || '') === 'premium'

  // orden cronológico + dedupe (mismo tipo+día)
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const seen = new Set<string>()
  const timeline = events.filter((e) => {
    const k = e.type + e.date
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return { isPremium, current, timeline }
}
