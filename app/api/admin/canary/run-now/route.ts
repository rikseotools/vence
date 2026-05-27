// app/api/admin/canary/run-now/route.ts
// Proxy admin que dispara los 5 canarios on-demand contra el backend
// Fargate (POST /api/v2/canary/run-now). Reenvía el Bearer del admin
// para que el JwtGuard + admin check del backend validen.
//
// Sin retry — si falla, el dashboard muestra error y el admin reintenta.
// 30s timeout porque 5 canarios paralelos pueden tardar (HTTP, BD, Redis).

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 35

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

const BACKEND_BASE = process.env.BACKEND_URL ?? 'https://api.vence.es'

async function _POST(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/admin/canary/run-now')
  if (!auth.success || !isAdmin(auth.email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const bearer = request.headers.get('authorization')
  if (!bearer) {
    return NextResponse.json(
      { error: 'Falta Authorization header (Bearer)' },
      { status: 400 },
    )
  }

  try {
    const backendRes = await fetch(`${BACKEND_BASE}/api/v2/canary/run-now`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: bearer,
        'User-Agent': 'Vence-Admin-Proxy/1.0',
      },
      body: '{}',
      signal: AbortSignal.timeout(30_000),
    })

    const body = await backendRes.text()
    return new NextResponse(body, {
      status: backendRes.status,
      headers: {
        'Content-Type':
          backendRes.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        success: false,
        error: `Proxy backend Fargate falló: ${msg}`,
      },
      { status: 502 },
    )
  }
}

export const POST = withErrorLogging('/api/admin/canary/run-now', _POST)
