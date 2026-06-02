// lib/api/shared/auth.ts
// Centraliza el patrón de autenticación duplicado en 30+ rutas API.
// Usado por 27 endpoints (admin, finance, ai-config, lifecycle, etc.).
//
// **REFACTOR 2026-05-11**: internamente delegado a `verifyAuth()` para
// portabilidad y latencia (Fase 0.7 — JWT local verify):
// - Latencia auth: 250-1000ms → <5ms (cuando JWT_LOCAL_VERIFY_MODE=on)
// - Portabilidad: cambiar provider auth = modificar 1 archivo (`verifyJwtLocal.ts`)
// - API externa intacta — los 27 callers no cambian
//
// El objeto `user` devuelto incluye solo {id, email} (lo único que usan
// los 27 callers según auditoría). Otros campos del User type de Supabase
// (app_metadata, user_metadata, role, etc.) quedan undefined — NINGÚN
// caller los lee actualmente.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

// ============================================
// Tipos
// ============================================

export type AuthResult =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

export type AdminResult =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

// ============================================
// Service client (bypass RLS)
// ============================================

export function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ============================================
// Autenticación de usuario via Bearer token
// ============================================
// Delegado a verifyAuth (wrapper Fase 0.7). Mantiene API legacy para los
// 27 callers existentes pero hereda los modos off/shadow/on del wrapper.

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthResult> {
  const auth = await verifyAuth(request, '/lib/api/shared/auth')
  if (!auth.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: auth.reason === 'no_bearer_token'
            ? 'No autorizado'
            : 'Usuario no autenticado',
        },
        { status: 401 }
      ),
    }
  }

  // Construir objeto User-compatible. Los 27 callers solo leen .id y .email
  // (verificado por auditoría 2026-05-11). Otros campos del User type quedan
  // undefined — Cast necesario porque User es interface compleja de Supabase.
  const user = {
    id: auth.userId,
    email: auth.email ?? undefined,
    // Campos requeridos por el interface User pero no usados por callers
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '',
  } as unknown as User

  return { ok: true, user, supabase: getServiceClient() }
}

// ============================================
// Autenticación + target_oposicion desde user_profiles
// ============================================
// Usado por endpoints que deben filtrar por oposición — NUNCA confiar en
// positionType que venga del cliente; derivarlo de la sesión autenticada.

export type AuthWithOposicionResult =
  | { ok: true; user: User; supabase: SupabaseClient; targetOposicion: string | null }
  | { ok: false; response: NextResponse }

export async function getAuthenticatedUserWithOposicion(
  request: NextRequest
): Promise<AuthWithOposicionResult> {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth

  let raw: string | null | undefined
  try {
    const [row] = await getAdminDb()
      .select({ target_oposicion: userProfiles.targetOposicion })
      .from(userProfiles)
      .where(eq(userProfiles.id, auth.user.id))
      .limit(1)
    raw = row?.target_oposicion
  } catch (error) {
    console.warn('⚠️ [auth] No se pudo leer target_oposicion:', (error as Error).message)
  }

  const targetOposicion = raw && raw.trim().length > 0 ? raw : null

  return { ok: true, user: auth.user, supabase: auth.supabase, targetOposicion }
}

// ============================================
// Verificación de admin (email whitelist)
// ============================================

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

export async function requireAdmin(
  request: NextRequest
): Promise<AdminResult> {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth

  if (!isAdminEmail(auth.user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      ),
    }
  }

  return auth
}
