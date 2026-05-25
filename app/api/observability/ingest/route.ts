// app/api/observability/ingest/route.ts
//
// HTTP gateway universal de observabilidad (Bloque 4, Gap 2).
//
// Desbloquea writers que NO pueden escribir directo a la BD vía Drizzle:
//   - Client-side (browser JS): `lib/observability/client.ts` envía batch
//     via navigator.sendBeacon — futuro Gap 1.
//   - GitHub Actions workflows: step `if: failure() && always()` →
//     curl POST con metadata del run — futuro Gap 6.
//   - Vercel deploy hooks: POST tras cada despliegue.
//   - Sentry webhook (futuro): espejar eventos Sentry a observable_events.
//
// Modos de auth (uno de los dos):
//   1. Header `x-ingest-secret = OBSERVABILITY_INGEST_SECRET` (server-to-
//      server: GHA, Vercel hooks, Sentry, etc.). Auth fuerte.
//   2. Client-side (browser): Origin/Referer == https://www.vence.es +
//      el evento debe tener source='frontend'. Sin secret (impossible
//      en client). Anti-spam: rate-limit por IP via header check
//      Vercel/middleware (futuro, hoy aceptable por bajo volumen).
//
// Batch INSERT vía Drizzle (mismo patrón que emit.ts interno). El
// fire-and-forget aplica a NIVEL DE CALLER (sendBeacon es non-blocking
// en el browser); aquí AWAITAMOS el INSERT para devolver count real al
// caller que sí espera (GHA, Sentry webhook).
//
// Ver docs/runbooks/observability.md §3 Gap 2.

import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { safeParseIngestRequest } from '@/lib/observability/schemas'

// Vercel default timeout 10s; ingest debe ser muy rápido (batch <50 INSERTs).
export const maxDuration = 10

// Hosts permitidos para modo client-side (Origin check).
// Aceptamos producción y los preview deploys Vercel; rechazamos cualquier
// otra cosa para evitar que terceros llenen la tabla.
const ALLOWED_ORIGINS = [
  'https://www.vence.es',
  'https://vence.es',
] as const

function isAllowedClientOrigin(originHeader: string | null): boolean {
  if (!originHeader) return false
  if ((ALLOWED_ORIGINS as readonly string[]).includes(originHeader)) return true
  // Preview deploys Vercel: *.vercel.app
  if (/^https:\/\/[\w-]+\.vercel\.app$/.test(originHeader)) return true
  return false
}

async function _POST(request: NextRequest): Promise<NextResponse> {
  // ─── 1. Auth — dos modos ──────────────────────────────────
  const ingestSecret = request.headers.get('x-ingest-secret')
  const expected = process.env.OBSERVABILITY_INGEST_SECRET
  const origin = request.headers.get('origin')

  // Modo A: server-to-server con secret (GHA, webhooks, Vercel hooks)
  const hasValidSecret = expected && ingestSecret === expected

  // Modo B: client-side desde origin permitido (browser)
  const hasValidOrigin = isAllowedClientOrigin(origin)

  if (!hasValidSecret && !hasValidOrigin) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // ─── 2. Parse + validate body ─────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'JSON inválido' },
      { status: 400 },
    )
  }

  const parsed = safeParseIngestRequest(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return NextResponse.json(
      {
        success: false,
        error: `Validación: ${firstIssue?.path.join('.')} - ${firstIssue?.message}`,
      },
      { status: 400 },
    )
  }

  const { events } = parsed.data

  // ─── 2.5 Seguridad: client-side solo puede emitir source='frontend' ──
  // Sin esta restricción, cualquiera desde www.vence.es (incluyendo
  // ataque XSS o tab malicioso) podría inyectar fake http_5xx, cron_run,
  // deploy_failed, etc — que dispararían alertas falsas y ahogarían la
  // señal real. Modo A (server con secret) NO tiene esta restricción.
  if (!hasValidSecret) {
    const invalidSource = events.find((e) => e.source !== 'frontend')
    if (invalidSource) {
      return NextResponse.json(
        {
          success: false,
          error: `Client-side ingest solo acepta source='frontend' (recibido: '${invalidSource.source}')`,
        },
        { status: 403 },
      )
    }
  }

  // ─── 3. Batch INSERT ──────────────────────────────────────
  const db = getAdminDb()
  if (!db) {
    return NextResponse.json(
      { success: false, error: 'BD no disponible' },
      { status: 503 },
    )
  }

  try {
    // Construir VALUES dinámicamente para batch insert de N filas.
    // Drizzle no expone bulk insert con sql\`\` raw fácilmente, pero
    // podemos hacer N INSERTs en una transacción (Postgres los agrupa
    // implícitamente en una sola round-trip al estar en pipeline).
    //
    // Alternativa explícita: armar VALUES (...),(...),(...) string,
    // pero el costo de N INSERTs simples es despreciable para batches
    // de 1-50 que es el caso normal.
    for (const event of events) {
      await db.execute(sql`
        INSERT INTO public.observable_events (
          ts, source, severity, event_type, endpoint, user_id,
          deploy_version, duration_ms, http_status, error_message, metadata
        ) VALUES (
          COALESCE(${event.ts ?? null}::timestamptz, NOW()),
          ${event.source},
          ${event.severity},
          ${event.eventType},
          ${event.endpoint ?? null},
          ${event.userId ?? null}::uuid,
          ${event.deployVersion ?? null},
          ${event.durationMs ?? null},
          ${event.httpStatus ?? null},
          ${event.errorMessage ?? null},
          ${event.metadata ? JSON.stringify(event.metadata) : null}::jsonb
        )
      `)
    }

    return NextResponse.json({
      success: true,
      inserted: events.length,
    })
  } catch (err) {
    console.error(
      '❌ [observability/ingest] INSERT falló:',
      err instanceof Error ? err.message : String(err),
    )
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 },
    )
  }
}

export const POST = withErrorLogging('/api/observability/ingest', _POST)
