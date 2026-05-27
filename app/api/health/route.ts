// app/api/health/route.ts
// Healthcheck público — verifica dependencias críticas con timeout corto.
// Diseñado para ALB target group y para diagnóstico rápido en incidentes.
//
// Devuelve siempre 200 con detalle JSON (status overall + por componente).
// Si necesitas que el ALB marque la task unhealthy, configurar el target group
// para que sólo acepte respuestas con field overall=ok (vía advanced settings
// matcher), o cambiar a 503 cuando overall=fail (decisión futura — hoy
// devolvemos 200 para que el alb no remueva la task ante un blip de Stripe).
//
// Diseñado para ser rápido (<2s) sin importar el estado real. Cada check
// tiene su propio timeout y no bloquea a los demás.
//
// Ejemplo de uso operativo:
//   curl https://www.vence.es/api/health
//   curl https://api.vence.es/health  (backend tiene su propio /health distinto)

import { NextResponse } from 'next/server'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 5

type CheckStatus = 'ok' | 'fail' | 'skipped'
type Check = {
  name: string
  status: CheckStatus
  durationMs: number
  detail?: string
}

const CHECK_TIMEOUT_MS = 2000

/** Wrap una promise con timeout. Devuelve {ok, durationMs, detail?} */
async function timed<T>(
  fn: () => Promise<T>,
  timeoutMs = CHECK_TIMEOUT_MS,
): Promise<{ ok: boolean; durationMs: number; detail?: string }> {
  const t0 = Date.now()
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs),
      ),
    ])
    return { ok: true, durationMs: Date.now() - t0 }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, durationMs: Date.now() - t0, detail: detail.slice(0, 200) }
  }
}

async function checkDatabase(): Promise<Check> {
  const r = await timed(async () => {
    const { getDb } = await import('@/db/client')
    const { sql } = await import('drizzle-orm')
    await getDb().execute(sql`SELECT 1`)
  })
  return {
    name: 'database',
    status: r.ok ? 'ok' : 'fail',
    durationMs: r.durationMs,
    detail: r.detail,
  }
}

async function checkPooler(): Promise<Check> {
  if (process.env.USE_SELF_HOSTED_POOLER !== 'true') {
    return { name: 'self_hosted_pooler', status: 'skipped', durationMs: 0, detail: 'flag off' }
  }
  const r = await timed(async () => {
    const { getPoolerDb } = await import('@/db/client')
    const { sql } = await import('drizzle-orm')
    await getPoolerDb().execute(sql`SELECT 1`)
  })
  return {
    name: 'self_hosted_pooler',
    status: r.ok ? 'ok' : 'fail',
    durationMs: r.durationMs,
    detail: r.detail,
  }
}

async function checkRedis(): Promise<Check> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { name: 'redis', status: 'skipped', durationMs: 0, detail: 'no upstash configured' }
  }
  const r = await timed(async () => {
    // Endpoint REST de Upstash — ping
    const url = process.env.UPSTASH_REDIS_REST_URL!
    const tok = process.env.UPSTASH_REDIS_REST_TOKEN!
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })
  return {
    name: 'redis',
    status: r.ok ? 'ok' : 'fail',
    durationMs: r.durationMs,
    detail: r.detail,
  }
}

async function checkStripe(): Promise<Check> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { name: 'stripe', status: 'skipped', durationMs: 0, detail: 'no key configured' }
  }
  const r = await timed(async () => {
    const { stripe } = await import('@/lib/stripe')
    // Listar 1 price — operación barata y read-only
    await stripe().prices.list({ limit: 1 })
  })
  return {
    name: 'stripe',
    status: r.ok ? 'ok' : 'fail',
    durationMs: r.durationMs,
    detail: r.detail,
  }
}

async function checkResend(): Promise<Check> {
  if (!process.env.RESEND_API_KEY) {
    return { name: 'resend', status: 'skipped', durationMs: 0, detail: 'no key configured' }
  }
  const r = await timed(async () => {
    // Endpoint de listar dominios — no envía email, es read-only.
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })
  return {
    name: 'resend',
    status: r.ok ? 'ok' : 'fail',
    durationMs: r.durationMs,
    detail: r.detail,
  }
}

async function _GET() {
  const t0 = Date.now()

  // Ejecutar todos los checks en paralelo (cada uno con su propio timeout).
  const [database, pooler, redis, stripeRes, resend] = await Promise.all([
    checkDatabase(),
    checkPooler(),
    checkRedis(),
    checkStripe(),
    checkResend(),
  ])

  const checks: Check[] = [database, pooler, redis, stripeRes, resend]
  const failed = checks.filter((c) => c.status === 'fail')
  const overall: 'ok' | 'degraded' | 'fail' =
    failed.length === 0 ? 'ok'
      : failed.some((c) => c.name === 'database') ? 'fail'  // BD caída = fail total
      : 'degraded'  // dependencias externas caídas pero BD viva = degraded

  return NextResponse.json(
    {
      overall,
      durationMs: Date.now() - t0,
      timestamp: new Date().toISOString(),
      deploy: process.env.GIT_COMMIT_SHA?.slice(0, 8) || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'unknown',
      checks,
    },
    {
      status: 200,  // Siempre 200 — ver comentario al inicio
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    },
  )
}

export const GET = withErrorLogging('/api/health', _GET as any)
