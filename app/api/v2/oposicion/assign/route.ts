// app/api/v2/oposicion/assign/route.ts
// Asigna automáticamente la oposición detectada por URL al usuario AUTENTICADO
// (components/OposicionDetector). Marca first_oposicion_detected_at la 1ª vez.
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('user_profiles') de cliente
// (upsert/insert/update — 3 workarounds RLS) por un único UPDATE Drizzle. El id
// sale SIEMPRE del TOKEN → imposible asignar oposición a otro usuario.
//
// NOTA: el perfil SIEMPRE existe a estas alturas (AuthContext lo crea en el 1er
// login vía ensure-profile, con email NOT NULL). Por eso UPDATE-only: el INSERT
// del original habría violado el NOT NULL de email en un perfil nuevo → nunca era
// el camino real. Si no actualiza ninguna fila devolvemos updated:false y el
// llamador reintenta (tiene su propio retry x3).
//
// [T-077, 07/08] Era un CUARTO write-path de `target_oposicion`, sin el guardarraíl de
// [T-508] (personalizada sin temario → 404 en el Header) que sí tiene `/api/profile/target`.
// El cliente (`OposicionDetector.tsx`) ya comprueba `!profile?.target_oposicion` antes de
// llamar, pero eso es el botón, no la puerta: "la de verdad es la del servidor"
// (`lib/oposicion/objetivoPersonalizado.ts`). Dos arreglos, mismo criterio que el hermano:
//   1. `WHERE target_oposicion IS NULL` — coincide con el propio propósito del endpoint
//      ("la 1ª vez"), no con el de onboarding (`onboarding_completed_at`), que es un
//      concepto distinto y no aplica aquí.
//   2. El mismo chequeo T-508, reutilizando `buscarPersonalizada` (extraída de
//      `/api/profile/target` a `lib/api/oposicion/buscarPersonalizada.ts` para que los dos
//      escritores compartan el criterio en vez de cada uno el suyo).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { esObjetivoPersonalizado, personalizadaUtilizable } from '@/lib/oposicion/objetivoPersonalizado'
import { buscarPersonalizada } from '@/lib/api/oposicion/buscarPersonalizada'
import { emitFireAndForget } from '@/lib/observability/emit'

export const maxDuration = 15

const bodySchema = z.object({
  oposicionId: z.string().min(1).max(255),
  oposicionData: z.record(z.string(), z.unknown()).nullish(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/oposicion/assign')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const { oposicionId, oposicionData } = parsed.data

  // [T-508] Mismo criterio que `/api/profile/target`: una personalizada sin un solo tema no
  // se puede fijar como objetivo (el Header enrutaría a un temario que da 404).
  if (esObjetivoPersonalizado(oposicionId)) {
    const personalizada = await buscarPersonalizada(oposicionId, auth.userId)
    if (personalizada && !personalizadaUtilizable(personalizada.temas)) {
      emitFireAndForget({
        source: 'vercel',
        severity: 'warn',
        eventType: 'objetivo_personalizado_vacio',
        endpoint: '/api/v2/oposicion/assign',
        metadata: { oposicionId, temas: personalizada.temas, bloqueado: true },
      })
      return NextResponse.json(
        {
          success: false,
          error: 'personalizada_sin_temario',
          message:
            'Esa oposición todavía no tiene ningún tema con contenido. Añádele leyes y artículos en el editor y vuelve a elegirla.',
        },
        { status: 409 },
      )
    }
  }

  const res = await getAdminDb().execute(sql`
    UPDATE user_profiles
    SET target_oposicion = ${oposicionId},
        target_oposicion_data = ${oposicionData ? JSON.stringify(oposicionData) : null}::jsonb,
        first_oposicion_detected_at = COALESCE(first_oposicion_detected_at, now()),
        updated_at = now()
    WHERE id = ${auth.userId}::uuid
      AND target_oposicion IS NULL
    RETURNING id
  `)
  const updated = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []).length > 0

  return NextResponse.json({ success: updated, updated })
}

export const POST = withErrorLogging('/api/v2/oposicion/assign', _POST)
