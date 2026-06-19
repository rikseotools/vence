// middleware.ts — Guard global de /api/admin/*
//
// Contexto (ver memoria project-admin-endpoints-sin-auth): NO había middleware,
// así que 38 rutas /api/admin/* eran invocables SIN autenticación (delete-user
// borraba cuentas sin token). Este middleware exige, para TODA ruta /api/admin/*:
//   - un Bearer token de un email admin (whitelist), O
//   - un x-cron-secret válido (para automatización: revalidate, health/*, etc.)
// La sesión del panel vive en localStorage (no cookie), por eso el panel manda
// el token en el header Authorization vía `adminFetch`/`getAuthHeaders` (Push A).
//
// No hay SUPABASE_JWT_SECRET ni jose en el proyecto → se valida el token llamando
// a supabase.auth.getUser(token) (1 roundtrip; el panel es de bajo tráfico).
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]
function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

export async function middleware(request: NextRequest) {
  // Preflight CORS: sin cuerpo ni acción, dejar pasar.
  if (request.method === 'OPTIONS') return NextResponse.next()

  // 1) Automatización por x-cron-secret (scripts/cron: revalidate, health/*…)
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return NextResponse.next()
  }

  // 2) Panel admin por Bearer token
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
    return NextResponse.next()
  } catch {
    return NextResponse.json({ error: 'Error de verificación de auth' }, { status: 401 })
  }
}

export const config = {
  matcher: '/api/admin/:path*',
}
