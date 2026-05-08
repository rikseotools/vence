// app/api/armando/auth/route.ts
// POST { password } → setea cookie httpOnly y devuelve { role }
// El password ya NO viaja al bundle del cliente.

import { NextResponse, type NextRequest } from 'next/server'
import { setSessionCookie, verifyPassword } from '@/lib/armando/session'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  const password = (body as { password?: unknown })?.password
  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json({ success: false, error: 'Password requerido' }, { status: 400 })
  }

  const role = verifyPassword(password)
  if (!role) {
    return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const res = NextResponse.json({ success: true, role })
  setSessionCookie(res.cookies, role)
  return res
}

export const POST = withErrorLogging('/api/armando/auth', _POST)
