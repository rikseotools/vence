// app/api/validation-error-log/route.ts
// Endpoint para que el cliente (watchdog) pueda logar errores de validación
// Fire-and-forget desde el cliente, no necesita respuesta elaborada

import { NextRequest, NextResponse } from 'next/server'
import { validationErrorLogSchema } from '@/lib/api/validation-error-log/schemas'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validationErrorLogSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/validation-error-log', _POST)
