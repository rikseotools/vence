// app/api/v2/auth/process-callback/route.ts
// Procesa el auth callback server-side (Drizzle, sin locks de Supabase)
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { safeParseProcessCallbackRequest } from '@/lib/api/auth/schemas'
import { processAuthCallback } from '@/lib/api/auth/queries'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
/**
 * POST /api/v2/auth/process-callback
 *
 * Recibe datos del usuario autenticado y procesa:
 * - Deteccion de usuario nuevo
 * - Upsert de perfil (user_profiles)
 * - Welcome email (para nuevos)
 * - IP de registro (para nuevos)
 *
 * Authorization: Bearer <session.access_token>
 */
async function _POST(request: NextRequest) {
  try {
    // 1. Verificar autenticacion
    const auth = await getAuthenticatedUser(request)
    if (!auth.ok) return auth.response

    // 2. Parsear y validar body
    const body = await request.json()
    const parseResult = safeParseProcessCallbackRequest(body)

    if (!parseResult.success) {
      console.error('❌ [API/v2/auth/process-callback] Validacion fallida:', parseResult.error)
      return NextResponse.json(
        { success: false, error: 'Datos invalidos', details: parseResult.error.format() },
        { status: 400 }
      )
    }

    // 3. Verificar que userId coincide con el token (seguridad)
    if (parseResult.data.userId !== auth.user.id) {
      console.error('❌ [API/v2/auth/process-callback] userId mismatch:', {
        bodyUserId: parseResult.data.userId,
        tokenUserId: auth.user.id,
      })
      return NextResponse.json(
        { success: false, error: 'userId no coincide con el token' },
        { status: 403 }
      )
    }

    // 4. Procesar callback
    const result = await processAuthCallback(parseResult.data, request)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/v2/auth/process-callback] Error inesperado:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/v2/auth/process-callback', _POST)
