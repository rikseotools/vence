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
import {
  esObjetivoPersonalizado,
  personalizadaUtilizable,
  ERROR_PERSONALIZADA_SIN_TEMARIO,
} from '@/lib/oposicion/objetivoPersonalizado'
import { buscarPersonalizada } from '@/lib/api/oposicionPersonalizada/consultas'
import { emitFireAndForget } from '@/lib/observability/emit'

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

  // [T-339] Misma comprobación que `/api/profile/target` (PUT), la SEGUNDA puerta de escritura
  // de `target_oposicion`. Sin esto, el onboarding fijaba como objetivo una personalizada sin
  // un solo tema — medido el 07/08: las 10 "más populares" que el propio onboarding ofrece
  // tienen las 10 cero temas — y el usuario aterrizaba después en un temario vacío sin ningún
  // aviso en el momento en que eligió. `esObjetivoPersonalizado`/`buscarPersonalizada` son
  // FAIL-OPEN: si la personalizada no existe, no es pública/tuya, o la consulta falla, esto no
  // bloquea nada — solo corta cuando SÍ se sabe que está vacía.
  if (field === 'target_oposicion' && typeof value === 'string' && esObjetivoPersonalizado(value)) {
    const personalizada = await buscarPersonalizada(value, uid)
    if (personalizada && !personalizadaUtilizable(personalizada.temas)) {
      emitFireAndForget({
        source: 'vercel',
        severity: 'warn',
        eventType: 'objetivo_personalizado_vacio',
        endpoint: '/api/v2/onboarding/save-field',
        metadata: { oposicionId: value, temas: personalizada.temas, bloqueado: true },
      })
      return NextResponse.json(
        { success: false, ...ERROR_PERSONALIZADA_SIN_TEMARIO },
        { status: 409 },
      )
    }
  }

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
