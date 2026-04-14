// app/api/v2/dispute/resolve/route.ts
// Endpoint admin para resolver/rechazar impugnaciones (legislativas y psicotecnicas)
// con notificacion email en el mismo flujo (sin trigger PG, sin cold-start).
//
// Auth: requireAdmin (email whitelist).
// Body: ResolveDisputeRequest (Zod validado).
// Respuesta: ResolveDisputeResponse | DisputeError.

import { NextRequest, NextResponse } from 'next/server'
import {
  resolveDisputeRequestSchema,
  resolveDispute,
} from '@/lib/api/v2/dispute'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _POST(request: NextRequest) {
  // 1. Auth admin
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  // 2. Parse + validar body con Zod
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body JSON invalido' },
      { status: 400 }
    )
  }

  const parsed = resolveDisputeRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Datos de entrada invalidos',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  // 3. Ejecutar resolveDispute (UPDATE + sendEmailV2 in-process)
  const result = await resolveDispute(parsed.data)

  if (!result.success) {
    // Errores logicos (no encontrada, ya resuelta, sin userId, etc.)
    const status = result.error.includes('no encontrada') ? 404 :
                   result.error.includes('ya estaba') ? 409 : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result)
}

export const POST = withErrorLogging('/api/v2/dispute/resolve', _POST)
