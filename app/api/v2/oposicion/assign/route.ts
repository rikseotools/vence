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

  const res = await getAdminDb().execute(sql`
    UPDATE user_profiles
    SET target_oposicion = ${oposicionId},
        target_oposicion_data = ${oposicionData ? JSON.stringify(oposicionData) : null}::jsonb,
        first_oposicion_detected_at = COALESCE(first_oposicion_detected_at, now()),
        updated_at = now()
    WHERE id = ${auth.userId}::uuid
    RETURNING id
  `)
  const updated = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []).length > 0

  return NextResponse.json({ success: updated, updated })
}

export const POST = withErrorLogging('/api/v2/oposicion/assign', _POST)
