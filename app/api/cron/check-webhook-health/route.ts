// app/api/cron/check-webhook-health/route.ts
//
// Detecta webhooks Stripe rotos antes de que los usuarios paguen sin activarse
// premium.
//
// ⚠️ El cron VIVO es el del backend Fargate
// (backend/src/check-webhook-health/*, @Cron cada 15min). Este endpoint quedó
// como entrada MANUAL/de depuración — su workflow GHA está en
// check-webhook-health.yml.DISABLED. Mantener los dos en el mismo criterio: si
// uno dice verde y el otro no, el de guardia es el backend.
//
// Origen: incidente 2026-05-26 — el webhook /api/stripe/webhook llevaba
// horas respondiendo 400 a TODOS los eventos de Stripe (bug en
// withErrorLogging consumiendo el raw body). NADIE se enteró hasta que
// Andrea pagó 20€, no se activó, y escribió al chat de soporte.
//
// Métrica: % de eventos en Stripe API con pending_webhooks > 0 en última
// hora, POR CUENTA. Si alguna cuenta supera el umbral, emite
// event_type='webhook_unhealthy' con severity='error'. La regla
// RULE_WEBHOOK_UNHEALTHY del alerts-engine dispara notificación.
//
// MULTI-CUENTA (29/07/2026): antes miraba solo STRIPE_SECRET_KEY (= Manuel).
// Con las altas nuevas en Nila, el webhook de Nila podía estar caído entero y
// esto seguía en verde. Cada cuenta se evalúa por separado (agregar diluye el
// fallo de la cuenta con menos volumen) y una cuenta que no se puede mirar
// sale como `degraded` (severity warn), nunca como verde.
//
// Coste: 0€ (1 llamada a events.list por cuenta cada ejecución, gratis).

import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { emit } from '@/lib/observability/emit'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { STRIPE_ACCOUNTS, getConfiguredAccounts, getStripeFor, type StripeAccount } from '@/lib/stripe'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Si más del UNHEALTHY_THRESHOLD_PCT de eventos en última hora tienen
// pending_webhooks>0, consideramos el webhook unhealthy. Stripe normalmente
// entrega en pocos segundos; pending sostenido indica fallos repetidos.
const UNHEALTHY_THRESHOLD_PCT = 10
const LOOKBACK_SECONDS = 3600 // 1 hora

interface AccountHealth {
  account: StripeAccount
  readable: boolean
  error?: string
  totalEvents: number
  pendingEvents: number
  pendingPct: number
  healthy: boolean
  oldestPendingType: string | null
  oldestPendingAgeS: number | null
}

interface WebhookHealthResponse {
  success: boolean
  totalEvents: number
  pendingEvents: number
  pendingPct: number
  healthy: boolean
  degraded: boolean
  unhealthyAccounts: StripeAccount[]
  accounts: AccountHealth[]
  oldestPending?: {
    type: string
    age_seconds: number
  }
}

async function scanAccount(account: StripeAccount, since: number): Promise<AccountHealth> {
  const stripe = getStripeFor(account)

  let total = 0
  let pending = 0
  let oldestPendingTs: number | null = null
  let oldestPendingType: string | null = null
  let starting_after: string | undefined

  // Paginar todos los eventos de la última hora (max ~300 normalmente)
  for (let page = 0; page < 10; page++) {
    const opts: Stripe.EventListParams = { limit: 100 }
    if (starting_after) opts.starting_after = starting_after
    const result = await stripe.events.list(opts)

    let cutoff = false
    for (const ev of result.data) {
      if (ev.created < since) {
        cutoff = true
        break
      }
      total++
      if (ev.pending_webhooks > 0) {
        pending++
        if (oldestPendingTs === null || ev.created < oldestPendingTs) {
          oldestPendingTs = ev.created
          oldestPendingType = ev.type
        }
      }
    }

    if (cutoff || !result.has_more || result.data.length === 0) break
    starting_after = result.data[result.data.length - 1].id
  }

  const pendingPct = total > 0 ? (pending * 100) / total : 0

  return {
    account,
    readable: true,
    totalEvents: total,
    pendingEvents: pending,
    pendingPct: Math.round(pendingPct * 10) / 10,
    healthy: pendingPct < UNHEALTHY_THRESHOLD_PCT,
    oldestPendingType,
    oldestPendingAgeS: oldestPendingTs ? Math.floor(Date.now() / 1000) - oldestPendingTs : null,
  }
}

async function _GET(request: NextRequest) {
  // Auth — mismo patrón que los otros crons
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const isAuthorized = authHeader === `Bearer ${cronSecret}` || isVercelCron
  if (!isAuthorized && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const configured = getConfiguredAccounts()
  if (configured.length === 0) {
    return NextResponse.json({ error: 'Ninguna cuenta Stripe configurada' }, { status: 500 })
  }

  const since = Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS

  const accounts: AccountHealth[] = await Promise.all(
    STRIPE_ACCOUNTS.map(async (account): Promise<AccountHealth> => {
      const blind = (error: string): AccountHealth => ({
        account, readable: false, error, totalEvents: 0, pendingEvents: 0,
        pendingPct: 0, healthy: false, oldestPendingType: null, oldestPendingAgeS: null,
      })
      // Cuenta conocida sin key en este entorno = punto ciego, se reporta.
      if (!configured.includes(account)) return blind('secret key no configurada')
      try {
        return await scanAccount(account, since)
      } catch (error) {
        return blind((error as Error).message)
      }
    }),
  )

  const readable = accounts.filter(a => a.readable)
  const unhealthyAccounts = readable.filter(a => !a.healthy).map(a => a.account)
  const healthy = unhealthyAccounts.length === 0
  const degraded = accounts.some(a => !a.readable)

  const total = readable.reduce((acc, a) => acc + a.totalEvents, 0)
  const pending = readable.reduce((acc, a) => acc + a.pendingEvents, 0)
  const pendingPct = total > 0 ? (pending * 100) / total : 0

  const oldest = readable
    .filter(a => a.oldestPendingAgeS !== null)
    .sort((a, b) => (b.oldestPendingAgeS ?? 0) - (a.oldestPendingAgeS ?? 0))[0]

  const response: WebhookHealthResponse = {
    success: true,
    totalEvents: total,
    pendingEvents: pending,
    pendingPct: Math.round(pendingPct * 10) / 10,
    healthy,
    degraded,
    unhealthyAccounts,
    accounts,
  }
  if (oldest?.oldestPendingAgeS != null) {
    response.oldestPending = {
      type: oldest.oldestPendingType ?? 'unknown',
      age_seconds: oldest.oldestPendingAgeS,
    }
  }

  // Emit SIEMPRE — cron_run liveness + métrica histórica.
  // error = cuenta legible por encima del umbral · warn = cuenta sin vigilar
  await emit({
    source: 'vercel',
    severity: !healthy ? 'error' : degraded ? 'warn' : 'info',
    eventType: healthy ? 'cron_run' : 'webhook_unhealthy',
    endpoint: '/api/cron/check-webhook-health',
    metadata: {
      cron: 'check-webhook-health',
      total_events_1h: total,
      pending_events_1h: pending,
      pending_pct: response.pendingPct,
      threshold_pct: UNHEALTHY_THRESHOLD_PCT,
      healthy,
      degraded,
      unhealthy_accounts: unhealthyAccounts.join(',') || null,
      unmonitored_accounts:
        accounts.filter(a => !a.readable).map(a => `${a.account}: ${a.error ?? 'sin leer'}`).join(' | ') || null,
      accounts,
      oldest_pending_type: oldest?.oldestPendingType ?? null,
      oldest_pending_age_s: oldest?.oldestPendingAgeS ?? null,
    },
  })

  return NextResponse.json(response)
}

export const GET = withErrorLogging('/api/cron/check-webhook-health', _GET)
