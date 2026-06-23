// app/api/v2/onboarding/save-field/route.ts
// Guardado progresivo de UN campo del onboarding del usuario AUTENTICADO
// (OnboardingModal.saveField: auto-save de ciudad/edad/horas/género/oposición).
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('user_profiles').update de
// cliente (PostgREST+RLS) por Drizzle. El id sale SIEMPRE del TOKEN verificado.
//
// SEGURIDAD: el nombre de columna NUNCA se interpola en el SQL. Se valida contra
// una WHITELIST cerrada (switch con nombres literales) → imposible que el cliente
// escriba columnas sensibles (plan_type, is_premium, email, …). Cada campo se
// castea a su tipo real (age/daily_study_hours integer, target_oposicion_data jsonb).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  field: z.enum([
    'age', 'gender', 'ciudad', 'daily_study_hours',
    'target_oposicion', 'target_oposicion_data',
  ]),
  value: z.unknown(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/onboarding/save-field')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_field' }, { status: 400 })
  }
  const { field, value } = parsed.data
  const uid = auth.userId
  const db = getAdminDb()

  // Switch con columnas LITERALES (nunca interpoladas) + cast por tipo real.
  switch (field) {
    case 'age':
      await db.execute(sql`UPDATE user_profiles SET age = ${value == null ? null : Number(value)}, updated_at = now() WHERE id = ${uid}::uuid`)
      break
    case 'daily_study_hours':
      await db.execute(sql`UPDATE user_profiles SET daily_study_hours = ${value == null ? null : Number(value)}, updated_at = now() WHERE id = ${uid}::uuid`)
      break
    case 'gender':
      await db.execute(sql`UPDATE user_profiles SET gender = ${value == null ? null : String(value)}, updated_at = now() WHERE id = ${uid}::uuid`)
      break
    case 'ciudad':
      await db.execute(sql`UPDATE user_profiles SET ciudad = ${value == null ? null : String(value)}, updated_at = now() WHERE id = ${uid}::uuid`)
      break
    case 'target_oposicion':
      await db.execute(sql`UPDATE user_profiles SET target_oposicion = ${value == null ? null : String(value)}, updated_at = now() WHERE id = ${uid}::uuid`)
      break
    case 'target_oposicion_data':
      await db.execute(sql`UPDATE user_profiles SET target_oposicion_data = ${value == null ? null : JSON.stringify(value)}::jsonb, updated_at = now() WHERE id = ${uid}::uuid`)
      break
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/onboarding/save-field', _POST)
