// app/api/profile/route.ts - API endpoint para perfil de usuario
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetProfileRequest,
  safeParseUpdateProfileRequest,
  getProfileForSelfCached,
  updateProfile
} from '@/lib/api/profile'
import { isAdminEmail } from '@/lib/api/shared/auth'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

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
// SHADOW-MODE AUTH CHECK (paso 3/7)
// ============================================
// Sólo loguea. NO bloquea. Permite identificar callers sin Bearer y posibles
// IDOR antes de activar el enforcement (paso 5). Envuelto en try/catch para
// que ningún fallo del auth pueda romper el endpoint.
//
// IMPORTANTE: hacemos decode local del JWT (NO verificamos firma) para evitar
// añadir un round-trip a Supabase Auth en cada request a /api/profile. La
// verificación real (con firma) la hará paso 5 cuando active el enforcement.
// Si un atacante envía un JWT manipulado, el peor caso aquí es un log
// inexacto; ningún acceso a datos depende de este check.

interface DecodedJwt {
  sub?: string
  email?: string
  exp?: number
}

function decodeJwtPayloadUnsafe(token: string): DecodedJwt | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // base64url → utf-8
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    return payload
  } catch {
    return null
  }
}

function shadowAuthCheck(
  request: NextRequest,
  requestedUserId: string,
  opType: 'GET' | 'PUT'
): void {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      console.warn(`🔍 [shadow] /api/profile ${opType} sin Bearer token`, {
        requestedUserId,
        ua: request.headers.get('user-agent')?.slice(0, 100) ?? 'unknown',
      })
      return
    }

    const payload = decodeJwtPayloadUnsafe(token)
    if (!payload?.sub) {
      console.warn(`🔍 [shadow] /api/profile ${opType} JWT sin sub`, {
        requestedUserId,
        ua: request.headers.get('user-agent')?.slice(0, 100) ?? 'unknown',
      })
      return
    }

    const sessionUserId = payload.sub
    const sessionEmail = payload.email

    if (sessionUserId !== requestedUserId && !isAdminEmail(sessionEmail)) {
      console.warn(`🔍 [shadow] /api/profile ${opType} IDOR potencial`, {
        sessionUserId,
        sessionEmail,
        requestedUserId,
      })
    }
    // Caso correcto: caller autenticado y dueño (o admin) — silencio.
  } catch (err) {
    // Nunca dejar que el shadow check rompa el endpoint
    console.warn('🔍 [shadow] excepción en auth check:', err)
  }
}

// ============================================
// GET: Obtener perfil de usuario
// ============================================

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Validar request con Zod
    const parseResult = safeParseGetProfileRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante' },
        { status: 400 }
      )
    }

    // Shadow-mode auth check (paso 3/7) — sólo loguea, no bloquea (sync, 0 ms)
    shadowAuthCheck(request, parseResult.data.userId, 'GET')

    // Obtener perfil (cache 60s, tag 'profile').
    // Proyección "self": excluye stripeCustomerId, registrationIp,
    // registrationUrl, adminNotes (sensibles, no necesarios al cliente).
    const result = await withDbTimeout(
      () => getProfileForSelfCached(parseResult.data),
      PROFILE_GET_TIMEOUT_MS,
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 404 })
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
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseUpdateProfileRequest(body)
    if (!parseResult.success) {
      console.warn('⚠️ [API/profile] Validación fallida:', parseResult.error.issues)
      return NextResponse.json(
        { success: false, error: 'Datos de perfil inválidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Shadow-mode auth check (paso 3/7) — sólo loguea, no bloquea (sync, 0 ms)
    shadowAuthCheck(request, parseResult.data.userId, 'PUT')

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
