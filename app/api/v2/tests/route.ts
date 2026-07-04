// app/api/v2/tests/route.ts
// POST /api/v2/tests — crea (o reutiliza) una sesión de test en RDS/Drizzle.
// Reemplaza la escritura directa del cliente a Supabase (utils/testSession.ts).
// Authz explícita: userId SIEMPRE del token verificado (verifyAuth), nunca del body.
import { NextRequest, NextResponse } from 'next/server'
import { safeParseCreateTestRequest, createTestSession, type CreateTestResponse } from '@/lib/api/v2/tests'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

async function _POST(request: NextRequest): Promise<NextResponse<CreateTestResponse>> {
  // 1. Auth
  const auth = await verifyAuth(request, '/api/v2/tests')
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Usuario no autenticado' },
      { status: 401 },
    )
  }

  // 2. Parse + validate
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = safeParseCreateTestRequest(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { success: false, error: `Validación: ${first?.path.join('.')} - ${first?.message}` },
      { status: 400 },
    )
  }

  // 3. Crear en BD (userId del token)
  const result = await createTestSession(parsed.data, auth.userId)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error ?? 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: result.id, reused: result.reused })
}

async function _GET() {
  return NextResponse.json({ success: false, error: 'Método no permitido. Usa POST.' }, { status: 405 })
}

export const POST = withErrorLogging('/api/v2/tests', _POST)
export const GET = withErrorLogging('/api/v2/tests', _GET)
