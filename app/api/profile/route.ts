// app/api/profile/route.ts - API endpoint para perfil de usuario
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import {
  safeParseUpdateProfileRequest,
  getProfileForSelfCached,
  updateProfile
} from '@/lib/api/profile'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { reconcileUserPremium } from '@/lib/api/checkout-sync'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'
export const revalidate = 0
// maxDuration bajado a 10s tras cascada del 8 may 23:27 UTC donde /api/profile
// hit 300s sin protección. Endpoint llamado en cada page load del user logueado.
export const maxDuration = 10

// Quick-fail timeout. La query es proyección de user_profiles + cache 60s
// (unstable_cache). 8s da margen para cold cache y aún corta antes del límite.
const PROFILE_GET_TIMEOUT_MS = 8000
const PROFILE_PUT_TIMEOUT_MS = 8000

// ============================================
// IDENTIDAD = TOKEN VERIFICADO (enforcement real)
// ============================================
// La identidad del perfil SIEMPRE se deriva del token verificado (verifyAuth,
// local <5ms con JWT_LOCAL_VERIFY_MODE=on), NUNCA del `?userId=`/`body.userId`
// que manda el cliente. Esto cierra dos defectos que coexistían con el antiguo
// `shadowAuthCheck` (que sólo logueaba, nunca bloqueaba — "paso 3/7" que jamás
// llegó al enforcement):
//   1. IDOR de lectura/escritura: cualquiera (incluso sin token) podía leer o
//      modificar el perfil de otro usuario pasando su uuid.
//   2. 404 "Perfil no encontrado" espurio: clientes que arrastran un id
//      stale/fantasma en el query → con el id del token resolvemos el perfil real.
// Sin token válido → 401 (antes: se servía igual / 404).

// ============================================
// GET: Obtener perfil de usuario
// ============================================

async function _GET(request: NextRequest) {
  try {
    // 🔒 Identidad SIEMPRE del token verificado (nunca del `?userId=`).
    const auth = await verifyAuth(request, '/api/profile')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
    const userId = auth.userId

    // Señal de observabilidad (no fatal): el cliente pidió un id distinto al del
    // token — id stale/fantasma (causa del 404) o intento de IDOR. Servimos el
    // del token igualmente. Se limita al mismatch para no ensuciar el log común.
    const claimed = new URL(request.url).searchParams.get('userId')
    if (claimed && claimed !== userId) {
      console.warn('🔒 [API/profile] GET userId del query ignorado (≠ token)', {
        claimed,
        tokenUserId: userId,
      })
    }

    // Obtener perfil (cache 60s, tag 'profile', key por userId del token).
    // Proyección "self": excluye stripeCustomerId, registrationIp,
    // registrationUrl, adminNotes (sensibles, no necesarios al cliente).
    const result = await withDbTimeout(
      () => getProfileForSelfCached({ userId }),
      PROFILE_GET_TIMEOUT_MS,
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 404 })
    }

    // ─── Sprint B (27/05/2026) — Auto-reconcile silencioso ───
    // Si el user tiene plan_type='free' (proyección self lo expone), disparamos
    // reconcileUserPremium en background DESPUÉS de devolver la respuesta.
    // No bloquea la latencia del GET. Si detecta sub active en Stripe que falta
    // en BD (caso usuario que pagó desde móvil + entra desde laptop, o caso
    // Andrea/Rocío/Mercedes con webhook roto), arregla en background — la
    // siguiente carga del perfil ya ve premium.
    //
    // Idempotente: si plan_type ya es premium, el helper sale early sin
    // tocar Stripe ni BD (zero cost).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileData = (result as any).data
    if (profileData?.planType === 'free') {
      after(async () => {
        try {
          const recon = await reconcileUserPremium(userId)
          if (recon.fixed) {
            console.log(`✅ [profile/auto-reconcile] Drift detectado y reparado para user ${userId.slice(0, 8)}`)
          }
        } catch (err) {
          // No propagar — el GET ya respondió. El error queda en observable_events.
          console.error('[profile/auto-reconcile] error:', err)
        }
      })
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })

  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/profile] GET Timeout (quick-fail):', error.timeoutMs, 'ms')
      return NextResponse.json(
        { success: false, error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
        { status: 503, headers: { 'Retry-After': '300' } },
      )
    }
    console.error('❌ [API/profile] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// PUT: Actualizar perfil de usuario
// ============================================

async function _PUT(request: NextRequest) {
  try {
    // 🔒 Identidad SIEMPRE del token verificado. El `userId` del body se IGNORA
    // (se sobreescribe con el del token) → imposible modificar el perfil de otro.
    const auth = await verifyAuth(request, '/api/profile')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validar request con Zod, forzando userId = token ANTES de validar/escribir.
    const parseResult = safeParseUpdateProfileRequest({
      ...(body as Record<string, unknown>),
      userId: auth.userId,
    })
    if (!parseResult.success) {
      console.warn('⚠️ [API/profile] Validación fallida:', parseResult.error.issues)
      return NextResponse.json(
        { success: false, error: 'Datos de perfil inválidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Actualizar perfil (write path)
    const result = await withDbTimeout(
      () => updateProfile(parseResult.data),
      PROFILE_PUT_TIMEOUT_MS,
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/profile] PUT Timeout (quick-fail):', error.timeoutMs, 'ms')
      return NextResponse.json(
        { success: false, error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
        { status: 503, headers: { 'Retry-After': '300' } },
      )
    }
    console.error('❌ [API/profile] Error PUT:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// OPTIONS: CORS preflight
// ============================================

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

export const GET = withErrorLogging('/api/profile', _GET)
export const PUT = withErrorLogging('/api/profile', _PUT)
