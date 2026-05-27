// app/api/v2/admin/feedback/find-user-by-email/route.ts
// Busca un user_profile por email exacto (lowercase). Usado por el
// modal de "crear conversación como admin" en /admin/feedback.
//
// Reemplaza un SELECT desde createClient(.., service_role) en cliente.
//
// Roadmap: docs/roadmap/agnosticismo-supabase.md — Fase 1.

import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const bodySchema = z.object({
  email: z.string().email(),
})

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Body inválido: requiere email' }, { status: 400 })
  }

  const db = getAdminDb()
  const [profile] = await db
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      fullName: userProfiles.fullName,
      nickname: userProfiles.nickname,
      planType: userProfiles.planType,
      targetOposicion: userProfiles.targetOposicion,
    })
    .from(userProfiles)
    .where(eq(userProfiles.email, parsed.data.email.toLowerCase()))
    .limit(1)

  if (!profile) {
    return NextResponse.json({ error: 'Usuario no encontrado con ese email' }, { status: 404 })
  }

  // Devolver con snake_case (el componente cliente lo consume así desde Supabase REST)
  return NextResponse.json({
    success: true,
    profile: {
      id: profile.id,
      email: profile.email,
      full_name: profile.fullName,
      nickname: profile.nickname,
      plan_type: profile.planType,
      target_oposicion: profile.targetOposicion,
    },
  })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/find-user-by-email', _POST as any)
