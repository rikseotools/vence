// app/api/armando/me/route.ts
// GET → { role } si la cookie es válida, 401 si no.
// Permite al cliente saber si tiene sesión sin tener acceso al password.

import { NextResponse, type NextRequest } from 'next/server'
import { readSession } from '@/lib/armando/session'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sess = readSession(req)
  if (!sess) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true, role: sess.role })
}
