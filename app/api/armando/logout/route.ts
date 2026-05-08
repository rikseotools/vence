// app/api/armando/logout/route.ts
// POST → limpia cookie de sesión.

import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/armando/session'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _POST(): Promise<NextResponse> {
  const res = NextResponse.json({ success: true })
  clearSessionCookie(res.cookies)
  return res
}

export const POST = withErrorLogging('/api/armando/logout', _POST)
