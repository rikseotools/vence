// app/api/v2/custom-oposiciones/popular/route.ts
// Lista de oposiciones personalizadas más seleccionadas (OnboardingModal:
// loadCustomOposiciones). NO es user-scoped: es un catálogo público de las custom
// más populares. Requiere sesión (el modal siempre va autenticado).
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('get_popular_custom_oposiciones')
// por la MISMA función plpgsql llamada vía Drizzle (getAdminDb). La función es
// param-driven (p_limit), portable a RDS/Neon sin cambios.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/custom-oposiciones/popular')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const limitParam = Number(new URL(request.url).searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 50 ? Math.floor(limitParam) : 10

  const res = await getAdminDb().execute(sql`SELECT * FROM get_popular_custom_oposiciones(${limit})`)
  const items = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, items })
}

export const GET = withErrorLogging('/api/v2/custom-oposiciones/popular', _GET)
