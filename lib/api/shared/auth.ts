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
import { isAdminEmail } from '@/lib/auth/adminEmails'
import { emitFireAndForget } from '@/lib/observability/emit'

// ============================================
// Tipos
// ============================================

// NOTA (10/07): se retiró el campo `supabase` de los resultados de auth — ningún
// caller lo usaba (los datos ya son agnósticos vía Drizzle) y creaba un cliente
// Supabase en CADA request autenticado. `getServiceClient` sigue existiendo solo
// para `authAdmin` (auth.users legacy, pre-flip).
export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

export type AdminResult =
  | { ok: true; user: User }
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

  return { ok: true, user }
}

// ============================================
// Identidad para endpoints que HOY la reciben del cliente (T-340)
// ============================================
//
// ## Por qué existe
//
// Los endpoints de pago (`/api/stripe/{cancel,reactivate,subscription,create-checkout}`)
// nacieron leyendo el `userId` del **cuerpo o de la query**, sin token. Es decir: la
// identidad la ponía quien llamaba. Con solo el UUID de otra persona —que viaja en
// respuestas de la propia app— se podía **cancelar su suscripción, reactivarla (volver a
// cobrarle) o leer sus datos de facturación**.
//
// Se descubrió el 30/07/2026 por una vía indirecta: durante una suplantación de solo
// lectura, un clic en «Reactivar suscripción» **se ejecutó de verdad** sobre la cuenta de
// una usuaria. El candado de la suplantación vive en `verifyAuth` —«el paso por el que pasan
// TODAS las APIs»— y estos endpoints no pasaban por ahí. La suplantación fue el síntoma; el
// fallo de autorización era el de fondo.
//
// ## La regla
//
// **La identidad sale del token y solo del token.** El id que mande el cliente se usa
// únicamente para detectar la discrepancia: si no coincide, es alguien operando sobre una
// cuenta ajena y se corta con 403.
//
// Devuelve el status REAL de `verifyAuth` (401 sin sesión, 403 si es una suplantación
// escribiendo) en vez de colapsarlo todo a 401 como `getAuthenticatedUser`: en un endpoint
// que mueve dinero, distinguir «no estás autenticado» de «no puedes hacer esto» es lo que
// permite diagnosticar sin adivinar.
export type IdentidadResult =
  | { ok: true; userId: string; email: string | null; impersonadoPor: string | null }
  | { ok: false; response: NextResponse }

export async function requireUsuarioPropio(
  request: NextRequest,
  endpoint: string,
  /** El id que afirma el cliente (body/query). NO se usa como identidad: solo se contrasta. */
  idQueAfirmaElCliente?: string | null,
): Promise<IdentidadResult> {
  const auth = await verifyAuth(request, endpoint)
  if (!auth.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            auth.status === 403
              ? 'Esta sesión es de solo lectura'
              : 'No autorizado',
          reason: auth.reason,
        },
        { status: auth.status },
      ),
    }
  }

  if (idQueAfirmaElCliente && idQueAfirmaElCliente !== auth.userId) {
    // No se «arregla» usando el del token en silencio: alguien está pidiendo actuar sobre
    // otra cuenta y eso tiene que verse. Es la firma exacta del abuso que abría el hueco.
    console.warn(`🔒 [auth] ${endpoint}: el cliente afirmó otro userId — bloqueado`)
    emitFireAndForget({
      source: 'vercel',
      severity: 'warn',
      eventType: 'auth_identidad_ajena_rechazada',
      endpoint,
      userId: auth.userId,
      metadata: { afirmado: idQueAfirmaElCliente },
    })
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    userId: auth.userId,
    email: auth.email,
    impersonadoPor: auth.impersonadoPor ?? null,
  }
}

// ============================================
// Autenticación + target_oposicion desde user_profiles
// ============================================
// Usado por endpoints que deben filtrar por oposición — NUNCA confiar en
// positionType que venga del cliente; derivarlo de la sesión autenticada.

export type AuthWithOposicionResult =
  | { ok: true; user: User; targetOposicion: string | null }
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

  return { ok: true, user: auth.user, targetOposicion }
}

// ============================================
// Verificación de admin (email whitelist)
// ============================================
// La allowlist vive en lib/auth/adminEmails (client-safe, fuente única). Se
// reexporta aquí para no romper los imports existentes de los 27 callers.

export { isAdminEmail }

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
