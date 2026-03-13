// app/api/validation-error-log/route.ts
// Endpoint para que el cliente (watchdog) pueda logar errores de validación
// Fire-and-forget desde el cliente, no necesita respuesta elaborada

import { NextRequest, NextResponse } from 'next/server'
import { logValidationError, classifyError } from '@/lib/api/validation-error-log'
import { validationErrorLogSchema } from '@/lib/api/validation-error-log/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validationErrorLogSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    logValidationError({
      ...parsed.data,
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
