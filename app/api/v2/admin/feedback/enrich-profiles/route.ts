// app/api/v2/admin/feedback/enrich-profiles/route.ts
// Carga 3 datasets agregados sobre un conjunto de userIds:
//   - user_profiles (info básica + plan)
//   - cancellation_feedback (refunds + cancelaciones por user_id)
//   - user_sessions (última sesión por user_id para mostrar dispositivo)
//
// Reemplaza 3 SELECTs concatenados con service_role en el componente
// cliente — fuga del service_role key.
//
// Roadmap: docs/roadmap/agnosticismo-supabase.md — Fase 1.

import { NextResponse, type NextRequest } from 'next/server'
import { inArray, desc } from 'drizzle-orm'
import { z } from 'zod/v3'
import { getAdminDb } from '@/db/client'
import { userProfiles, cancellationFeedback, userSessions, userSubscriptions } from '@/db/schema'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const bodySchema = z.object({
  userIds: z.array(z.string().uuid()).max(500).default([]),
  // Emails huérfanos: feedbacks sin user_id que igual pueden tener perfil
  // por su email. Devolvemos como `emailProfiles` aparte.
  orphanEmails: z.array(z.string().email()).max(500).default([]),
}).refine(d => d.userIds.length > 0 || d.orphanEmails.length > 0, {
  message: 'Requiere al menos userIds o orphanEmails',
})

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body inválido: requiere userIds (array uuid, max 500)' },
      { status: 400 },
    )
  }

  const ids = parsed.data.userIds
  const emails = parsed.data.orphanEmails
  const db = getAdminDb()

  const profileColumns = {
    id: userProfiles.id,
    fullName: userProfiles.fullName,
    email: userProfiles.email,
    planType: userProfiles.planType,
    registrationDate: userProfiles.registrationDate,
    createdAt: userProfiles.createdAt,
    targetOposicion: userProfiles.targetOposicion,
    isActiveStudent: userProfiles.isActiveStudent,
    ciudad: userProfiles.ciudad,
  }
  type ProfileRow = {
    id: string
    fullName: string | null
    email: string
    planType: string | null
    registrationDate: string | null
    createdAt: string | null
    targetOposicion: string | null
    isActiveStudent: boolean | null
    ciudad: string | null
  }
  const toSnake = (p: ProfileRow) => ({
    id: p.id,
    full_name: p.fullName,
    email: p.email,
    plan_type: p.planType,
    registration_date: p.registrationDate,
    created_at: p.createdAt,
    target_oposicion: p.targetOposicion,
    is_active_student: p.isActiveStudent,
    ciudad: p.ciudad,
  })

  // Paralelizar — todas las queries son independientes.
  const [profilesRows, cancellationsRows, sessionsRows, emailProfilesRows, subscriptionsRows] = await Promise.all([
    ids.length > 0
      ? db.select(profileColumns).from(userProfiles).where(inArray(userProfiles.id, ids))
      : Promise.resolve([]),
    ids.length > 0
      ? db
          .select({
            userId: cancellationFeedback.userId,
            cancellationType: cancellationFeedback.cancellationType,
          })
          .from(cancellationFeedback)
          .where(inArray(cancellationFeedback.userId, ids))
      : Promise.resolve([]),
    ids.length > 0
      ? db
          .select({
            userId: userSessions.userId,
            browserName: userSessions.browserName,
            operatingSystem: userSessions.operatingSystem,
            deviceModel: userSessions.deviceModel,
            userAgent: userSessions.userAgent,
            sessionStart: userSessions.sessionStart,
          })
          .from(userSessions)
          .where(inArray(userSessions.userId, ids))
          .orderBy(desc(userSessions.sessionStart))
      : Promise.resolve([]),
    emails.length > 0
      ? db.select(profileColumns).from(userProfiles).where(inArray(userProfiles.email, emails))
      : Promise.resolve([]),
    // Suscripción (1 por usuario): hasta cuándo tiene premium + si cancela al final del período.
    ids.length > 0
      ? db
          .select({
            userId: userSubscriptions.userId,
            currentPeriodEnd: userSubscriptions.currentPeriodEnd,
            cancelAtPeriodEnd: userSubscriptions.cancelAtPeriodEnd,
            status: userSubscriptions.status,
          })
          .from(userSubscriptions)
          .where(inArray(userSubscriptions.userId, ids))
      : Promise.resolve([]),
  ])

  return NextResponse.json({
    success: true,
    profiles: profilesRows.map(toSnake),
    cancellations: cancellationsRows.map((c) => ({
      user_id: c.userId,
      cancellation_type: c.cancellationType,
    })),
    sessions: sessionsRows.map((s) => ({
      user_id: s.userId,
      browser_name: s.browserName,
      operating_system: s.operatingSystem,
      device_model: s.deviceModel,
      user_agent: s.userAgent,
      session_start: s.sessionStart,
    })),
    emailProfiles: emailProfilesRows.map(toSnake),
    subscriptions: subscriptionsRows.map((s) => ({
      user_id: s.userId,
      current_period_end: s.currentPeriodEnd,
      cancel_at_period_end: s.cancelAtPeriodEnd,
      status: s.status,
    })),
  })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/enrich-profiles', _POST as any)
