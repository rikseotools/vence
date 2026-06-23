// app/api/v2/onboarding/status/route.ts
// Devuelve los campos de onboarding del usuario AUTENTICADO. Lo consumen:
//   - hooks/useOnboarding.ts (fallback cuando AuthContext.userProfile sigue null tras 5s)
//   - components/OnboardingModal.tsx (loadExistingProfile, pre-rellena el formulario;
//     por eso incluye target_oposicion_data)
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('user_profiles').select(...)
// .eq('id', user.id) de cliente (PostgREST+RLS) por Drizzle. El id sale del
// TOKEN verificado (verifyAuth), NUNCA de un prop/body → imposible leer el perfil
// de otro usuario.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/onboarding/status')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  const rows = await getAdminDb().execute(sql`
    SELECT target_oposicion, target_oposicion_data, onboarding_completed_at, age,
           gender, ciudad, daily_study_hours, onboarding_skip_count,
           onboarding_last_skip_at
    FROM user_profiles
    WHERE id = ${auth.userId}::uuid
    LIMIT 1
  `)
  const list = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
  const profile = list[0] ?? null

  return NextResponse.json({ success: true, profile })
}

export const GET = withErrorLogging('/api/v2/onboarding/status', _GET)
