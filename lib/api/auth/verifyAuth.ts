// lib/api/auth/verifyAuth.ts
// Wrapper de verificación de auth para endpoints API. Soporta 3 modos via env:
//
//   JWT_LOCAL_VERIFY_MODE=off     → Solo getUser() remoto (comportamiento actual)
//   JWT_LOCAL_VERIFY_MODE=shadow  → Ambos en paralelo, log diff, sirve remoto
//   JWT_LOCAL_VERIFY_MODE=on      → Solo verifyJwtLocal (ahorra round-trip)
//
// PROPÓSITO: red de seguridad para migrar de auth.getUser() (250-1000ms HTTP
// round-trip) a verificación local <5ms sin riesgo de bypass.
//
// FLUJO RECOMENDADO:
//   1. Deploy con MODE=off — comportamiento idéntico al actual
//   2. Set MODE=shadow en producción durante 24-48h. Observar logs.
//      Si hay 0 divergencias → confianza alta.
//   3. Set MODE=on. Latencia baja de 1.5s p50 → 0.5s p50.
//   4. Tras 1 semana sin issues, opcionalmente eliminar el round-trip residual.
//
// ROLLBACK: env var → off + redeploy. <2 min.
//
// LOGS DE DIVERGENCIA: si shadow detecta que getUser y verifyJwtLocal devuelven
// resultados distintos, se loguea WARNING a Sentry y a validation_error_logs
// para investigar antes de hacer flip a 'on'.

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { verifyJwtLocal, extractBearerToken } from './verifyJwtLocal'
import { logValidationError } from '@/lib/api/validation-error-log'

export type AuthVerifyResult =
  | {
      success: true
      userId: string
      email: string | null
      /** Cómo se verificó: importante para diagnóstico de divergencias. */
      verifiedBy: 'remote' | 'local' | 'shadow_remote'
    }
  | {
      success: false
      status: 401
      reason: string
    }

type Mode = 'off' | 'shadow' | 'on'

function getMode(): Mode {
  const v = process.env.JWT_LOCAL_VERIFY_MODE
  if (v === 'shadow') return 'shadow'
  if (v === 'on') return 'on'
  return 'off' // default seguro
}

async function verifyRemote(token: string): Promise<{ userId: string; email: string | null } | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return { userId: user.id, email: user.email ?? null }
  } catch {
    return null
  }
}

/**
 * Verifica el Bearer token del request y devuelve el user autenticado.
 * Encapsula la decisión de modo (off/shadow/on) y el shadow comparison.
 *
 * @param request NextRequest con header Authorization
 * @param endpoint Identificador para logs (e.g. '/api/v2/answer-and-save')
 */
export async function verifyAuth(
  request: NextRequest,
  endpoint: string,
): Promise<AuthVerifyResult> {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)
  if (!token) {
    return { success: false, status: 401, reason: 'no_bearer_token' }
  }

  const mode = getMode()

  // Modo off: comportamiento legacy (solo remoto)
  if (mode === 'off') {
    const remote = await verifyRemote(token)
    if (!remote) {
      return { success: false, status: 401, reason: 'remote_verify_failed' }
    }
    return {
      success: true,
      userId: remote.userId,
      email: remote.email,
      verifiedBy: 'remote',
    }
  }

  // Modo on: solo local (latencia <5ms)
  if (mode === 'on') {
    const local = verifyJwtLocal(token)
    if (!local.success) {
      // Log details para diagnóstico (sin token completo por seguridad)
      console.warn(`🔒 [auth/local] ${endpoint} rejected: ${local.error}`)
      return { success: false, status: 401, reason: `local_${local.error}` }
    }
    return {
      success: true,
      userId: local.userId,
      email: local.email,
      verifiedBy: 'local',
    }
  }

  // Modo shadow: AMBAS verificaciones en paralelo, log diff, sirve remoto
  const [localResult, remoteResult] = await Promise.all([
    Promise.resolve(verifyJwtLocal(token)),
    verifyRemote(token),
  ])

  // Compute divergence
  const localOk = localResult.success
  const remoteOk = remoteResult !== null
  let diverged = false
  let divergenceKind: string | null = null

  if (localOk !== remoteOk) {
    diverged = true
    divergenceKind = localOk ? 'local_ok_remote_fail' : 'remote_ok_local_fail'
  } else if (localOk && remoteOk) {
    if (localResult.userId !== remoteResult!.userId) {
      diverged = true
      divergenceKind = 'userid_mismatch'
    } else if (localResult.email !== remoteResult!.email) {
      // Email puede divergir si el user cambió email desde que se firmó el token.
      // No es bypass de seguridad pero merece nota.
      diverged = true
      divergenceKind = 'email_mismatch'
    }
  }

  if (diverged) {
    const localUserId = localOk ? localResult.userId.slice(0, 8) : null
    const remoteUserId = remoteOk ? remoteResult!.userId.slice(0, 8) : null
    console.warn(
      `🔒 [auth/shadow] DIVERGENCE in ${endpoint}: kind=${divergenceKind} ` +
      `local=${localOk ? `ok(${localUserId})` : `fail(${localResult.success ? '' : localResult.error})`} ` +
      `remote=${remoteOk ? `ok(${remoteUserId})` : 'fail'}`
    )
    // Fire-and-forget: log a BD para análisis posterior
    logValidationError({
      endpoint,
      errorType: 'shadow_auth_divergence',
      errorMessage: `divergence kind=${divergenceKind}`,
      severity: 'warning',
      httpStatus: 200, // shadow no afecta UX
      requestBody: {
        local_ok: localOk,
        remote_ok: remoteOk,
        local_error: localOk ? null : (localResult as { error: string }).error,
        kind: divergenceKind,
      },
    })
  }

  // En shadow, SIEMPRE servimos el resultado del remoto (comportamiento idéntico al actual)
  if (!remoteOk) {
    return { success: false, status: 401, reason: 'remote_verify_failed' }
  }
  return {
    success: true,
    userId: remoteResult!.userId,
    email: remoteResult!.email,
    verifiedBy: 'shadow_remote',
  }
}

/**
 * Variante para endpoints con auth OPCIONAL (anónimos permitidos).
 * Devuelve userId/email si el token verifica, null si no hay token o falla.
 * No devuelve error — el endpoint decide qué hacer con el null.
 *
 * Usa el mismo wrapper `verifyAuth` interno → respeta el mismo JWT_LOCAL_VERIFY_MODE
 * (off/shadow/on) que los endpoints con auth obligatoria.
 */
export async function verifyAuthOptional(
  request: NextRequest,
  endpoint: string,
): Promise<{ userId: string; email: string | null } | null> {
  const result = await verifyAuth(request, endpoint)
  if (!result.success) return null
  return { userId: result.userId, email: result.email }
}
