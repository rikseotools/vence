// app/api/armando/logout/route.ts
// POST → limpia cookie de sesión.

import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/armando/session'

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ success: true })
  clearSessionCookie(res.cookies)
  return res
}
