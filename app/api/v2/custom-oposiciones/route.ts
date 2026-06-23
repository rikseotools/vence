// app/api/v2/custom-oposiciones/route.ts
// Crea (o reutiliza si ya existe una igual) una oposición personalizada y la
// asocia al usuario (OnboardingModal: handleCreateCustomOposicion).
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('create_or_select_custom_oposicion')
// por la MISMA función plpgsql vía Drizzle. RETURNS jsonb → { oposicion_id, ... }.
//
// SEGURIDAD: p_user_id sale SIEMPRE del TOKEN verificado, NUNCA del body → un
// usuario no puede crear oposiciones a nombre de otro. El nombre de display
// (created_by_username) sí es del body (campo no sensible, igual que ensure-profile).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  nombre: z.string().min(1).max(255),
  categoria: z.string().max(120).nullish(),
  administracion: z.string().max(120).nullish(),
  descripcion: z.string().max(2000).nullish(),
  createdByUsername: z.string().max(255).nullish(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/custom-oposiciones')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const b = parsed.data
  const createdBy = b.createdByUsername || auth.email?.split('@')[0] || null

  const res = await getAdminDb().execute(sql`
    SELECT create_or_select_custom_oposicion(
      p_user_id => ${auth.userId}::uuid,
      p_nombre => ${b.nombre},
      p_categoria => ${b.categoria ?? null},
      p_administracion => ${b.administracion ?? null},
      p_descripcion => ${b.descripcion ?? null},
      p_is_public => true,
      p_created_by_username => ${createdBy}
    ) AS result
  `)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  const result = (rows[0] as { result?: { oposicion_id?: string } } | undefined)?.result ?? null

  return NextResponse.json({ success: true, result, oposicionId: result?.oposicion_id ?? null })
}

export const POST = withErrorLogging('/api/v2/custom-oposiciones', _POST)
