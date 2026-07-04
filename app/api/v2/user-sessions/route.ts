// app/api/v2/user-sessions/route.ts
// POST /api/v2/user-sessions — crea fila user_sessions en RDS/Drizzle (agnóstico).
// Reemplaza la escritura directa del cliente a Supabase. userId del token.
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseCreateUserSessionRequest,
  createUserSession,
  type CreateUserSessionResponse,
} from '@/lib/api/v2/user-sessions'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

async function _POST(request: NextRequest): Promise<NextResponse<CreateUserSessionResponse>> {
  const auth = await verifyAuth(request, '/api/v2/user-sessions')
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Usuario no autenticado' },
      { status: 401 },
    )
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = safeParseCreateUserSessionRequest(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Validación' }, { status: 400 })
  }
  const result = await createUserSession(parsed.data, auth.userId)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error ?? 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: result.id })
}

export const POST = withErrorLogging('/api/v2/user-sessions', _POST)
