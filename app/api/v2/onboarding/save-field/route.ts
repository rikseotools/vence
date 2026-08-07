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

/** `db.execute(sql...)` no da SIEMPRE la misma forma (array plano de postgres.js vs `{rows:[...]}`
 * de otros drivers/mocks) — mismo patrón defensivo que los routes hermanos de este directorio
 * (`custom-oposiciones/route.ts`, `custom-oposiciones/popular/route.ts`). */
function filas(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] })?.rows || []
}

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
    // [T-077] `target_oposicion`/`target_oposicion_data`: este endpoint es de ONBOARDING (lo
    // dice el nombre de la ruta), pero el servidor no lo hacía cumplir — nada impedía llamarlo
    // con un token válido en cualquier momento, ya hubieras completado el onboarding o no.
    // El único freno era la UI (el botón que reabre el modal solo aparece con
    // `!target_oposicion`, ClientLayoutContent.tsx) — la puerta de verdad tiene que estar en
    // el servidor (lib/oposicion/objetivoPersonalizado.ts: "La de verdad es la del servidor;
    // la del botón está para que el usuario no llegue a chocar con ella"). Sin esto, CUALQUIER
    // usuario —tenga oposición o no, plan que tenga— podía llamar este endpoint directo y
    // cambiar su objetivo sin pasar por `/api/profile/target` (el escritor "canónico" no lo
    // era: había una puerta trasera sin ningún guardarraíl, ni siquiera el de T-508
    // "personalizada sin temario").
    //
    // Guarda `onboarding_completed_at IS NULL`, NO `target_oposicion IS NULL`: dentro de UNA
    // sesión de onboarding el usuario puede pulsar varias oposiciones antes de terminar
    // (cada click guarda al momento, sin esperar al botón «Completar») — gatear por la columna
    // que se está escribiendo se autobloquearía en el segundo click. `onboarding_completed_at`
    // solo se fija al FINAL (lib/api/v2/complete-onboarding/queries.ts), así que permite
    // repicar dentro de la sesión y cierra la puerta en cuanto el onboarding termina de verdad.
    case 'target_oposicion': {
      const r = value == null
        ? await db.execute(sql`UPDATE user_profiles SET target_oposicion = NULL, updated_at = now() WHERE id = ${uid}::uuid RETURNING id`)
        : await db.execute(sql`UPDATE user_profiles SET target_oposicion = ${String(value)}, updated_at = now() WHERE id = ${uid}::uuid AND onboarding_completed_at IS NULL RETURNING id`)
      if (filas(r).length === 0 && value != null) {
        return NextResponse.json(
          { success: false, error: 'onboarding_ya_completado', message: 'Ya completaste el onboarding — para cambiar de oposición usa el selector, no este endpoint.' },
          { status: 409 },
        )
      }
      break
    }
    case 'target_oposicion_data': {
      const r = value == null
        ? await db.execute(sql`UPDATE user_profiles SET target_oposicion_data = NULL, updated_at = now() WHERE id = ${uid}::uuid RETURNING id`)
        : await db.execute(sql`UPDATE user_profiles SET target_oposicion_data = ${JSON.stringify(value)}::jsonb, updated_at = now() WHERE id = ${uid}::uuid AND onboarding_completed_at IS NULL RETURNING id`)
      if (filas(r).length === 0 && value != null) {
        return NextResponse.json(
          { success: false, error: 'onboarding_ya_completado', message: 'Ya completaste el onboarding — para cambiar de oposición usa el selector, no este endpoint.' },
          { status: 409 },
        )
      }
      break
    }
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/onboarding/save-field', _POST)
