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

  // [T-339] CUARTA puerta de escritura de `target_oposicion`, encontrada al revisar las otras
  // tres. Su `bodySchema` acepta CUALQUIER string de hasta 255 caracteres y hacía el UPDATE sin
  // mirar nada: hoy su único llamante (`OposicionDetector`) solo manda ids del catálogo
  // estático, así que desde la UI no es alcanzable — pero el endpoint no lo impide, y cualquier
  // usuario autenticado puede llamarlo directo con una personalizada de 0 temas y reproducir el
  // bug original por la vía que ni la ficha ni la entrega auditaron.
  //
  // MISMO criterio puro que las otras tres (`personalizadaUtilizable`) y MISMA consulta
  // (`buscarPersonalizada`): una cuarta puerta con su propia regla no protegería, se
  // contradiría con las demás. FAIL-OPEN igual que ellas — solo corta cuando SÍ se sabe vacía.
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
        { success: false, ...ERROR_PERSONALIZADA_SIN_TEMARIO },
        { status: 409 },
      )
    }
  }

  // [T-077] `AND target_oposicion IS NULL`: este endpoint es la asignación AUTOMÁTICA de la 1ª
  // vez (lo llama `OposicionDetector` en cada visita autenticada a una landing), así que sin esa
  // condición reescribía en silencio el objetivo que el usuario ya había elegido. El cliente ya
  // comprueba `!profile?.target_oposicion` antes de llamar, pero eso es el botón, no la puerta.
  // Y el `updated` de abajo solo tiene sentido con ella: sin la condición el UPDATE afecta
  // siempre a una fila y `updated` sería siempre `true`. Cambiar de oposición A PROPÓSITO no
  // pasa por aquí — va por `/api/profile/target`.
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
