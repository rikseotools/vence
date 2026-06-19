// lib/security/adminApiGuard.ts
// Guard de /api/admin/* para el proxy (Next 16+). Devuelve una NextResponse de
// rechazo (401/403) si NO está autorizado, o null si pasa.
//
// Contexto (project-admin-endpoints-sin-auth): no había guard global → 38 rutas
// admin invocables sin auth (delete-user borraba cuentas sin token). La sesión
// del panel vive en localStorage (no cookie), por eso el panel manda el Bearer
// por header (adminFetch/getAuthHeaders, Push A). Automatización (revalidate,
// health/*…) usa x-cron-secret. No hay SUPABASE_JWT_SECRET/jose → se valida el
// token con supabase.auth.getUser (1 roundtrip; el panel es de bajo tráfico).
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

/** null = autorizado (continúa); NextResponse = rechazado. */
export async function guardAdminApi(request: NextRequest): Promise<NextResponse | null> {
  // Preflight CORS: sin cuerpo ni acción.
  if (request.method === 'OPTIONS') return null

  // 1) Automatización por x-cron-secret (scripts/cron: revalidate, health/*…).
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return null
  }

  // 2) Panel admin por Bearer token.
  const authz = request.headers.get('authorization') || ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : null
  if (!token) {
    return NextResponse.json({ error: 'No autorizado (falta token admin)' }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    if (!isAdminEmail(data.user.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    return null
  } catch {
    return NextResponse.json({ error: 'Error de verificación de auth' }, { status: 401 })
  }
}
