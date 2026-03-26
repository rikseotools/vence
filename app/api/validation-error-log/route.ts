// app/api/validation-error-log/route.ts
// Endpoint para que el cliente (watchdog) pueda logar errores de validación
// Fire-and-forget desde el cliente, no necesita respuesta elaborada

import { NextRequest, NextResponse } from 'next/server'
import { validationErrorLogSchema } from '@/lib/api/validation-error-log/schemas'
import { logValidationError } from '@/lib/api/validation-error-log'

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validationErrorLogSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    // Persistir en BD (fire-and-forget, no bloquea la respuesta)
    logValidationError(parsed.data)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

// Sin wrapper de error logging para evitar loop si este endpoint falla
export const POST = _POST
