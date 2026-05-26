// app/api/cron/check-webhook-health/route.ts
//
// Cron 15-min: detecta webhook Stripe rotos antes de que los usuarios paguen
// sin activarse premium.
//
// Origen: incidente 2026-05-26 — el webhook /api/stripe/webhook llevaba
// horas respondiendo 400 a TODOS los eventos de Stripe (bug en
// withErrorLogging consumiendo el raw body). NADIE se enteró hasta que
// Andrea pagó 20€, no se activó, y escribió al chat de soporte.
//
// Métrica: % de eventos en Stripe API con pending_webhooks > 0 en última
// hora. Si supera el umbral, emite event_type='webhook_unhealthy' con
// severity='error'. La regla RULE_WEBHOOK_UNHEALTHY del alerts-engine
// dispara notificación.
//
// Coste: 0€ (1 llamada a stripe.events.list cada 15min, gratis).

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { emit } from '@/lib/observability/emit'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Si más del UNHEALTHY_THRESHOLD_PCT de eventos en última hora tienen
// pending_webhooks>0, consideramos el webhook unhealthy. Stripe normalmente
// entrega en pocos segundos; pending sostenido indica fallos repetidos.
const UNHEALTHY_THRESHOLD_PCT = 10
const LOOKBACK_SECONDS = 3600 // 1 hora

interface WebhookHealthResponse {
  success: boolean
  totalEvents: number
  pendingEvents: number
  pendingPct: number
  healthy: boolean
  oldestPending?: {
    type: string
    age_seconds: number
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

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey)
  const since = Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS

  // Paginar todos los eventos de la última hora (max ~300 normalmente)
  let total = 0
  let pending = 0
  let oldestPendingTs: number | null = null
  let oldestPendingType: string | null = null
  let starting_after: string | undefined

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

    if (cutoff || !result.has_more) break
    starting_after = result.data[result.data.length - 1].id
  }

  const pendingPct = total > 0 ? (pending * 100) / total : 0
  const healthy = pendingPct < UNHEALTHY_THRESHOLD_PCT

  const response: WebhookHealthResponse = {
    success: true,
    totalEvents: total,
    pendingEvents: pending,
    pendingPct: Math.round(pendingPct * 10) / 10,
    healthy,
  }
  if (oldestPendingTs) {
    response.oldestPending = {
      type: oldestPendingType ?? 'unknown',
      age_seconds: Math.floor(Date.now() / 1000) - oldestPendingTs,
    }
  }

  // Emit SIEMPRE — cron_run liveness + métrica histórica
  await emit({
    source: 'vercel',
    severity: healthy ? 'info' : 'error',
    eventType: healthy ? 'cron_run' : 'webhook_unhealthy',
    endpoint: '/api/cron/check-webhook-health',
    metadata: {
      cron: 'check-webhook-health',
      total_events_1h: total,
      pending_events_1h: pending,
      pending_pct: response.pendingPct,
      threshold_pct: UNHEALTHY_THRESHOLD_PCT,
      oldest_pending_type: oldestPendingType ?? null,
      oldest_pending_age_s: oldestPendingTs ? Math.floor(Date.now() / 1000) - oldestPendingTs : null,
    },
  })

  return NextResponse.json(response)
}

export const GET = withErrorLogging('/api/cron/check-webhook-health', _GET)
