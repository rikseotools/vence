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
//   2. (Futuro Gap 1) Cookie de sesión Supabase + Origin check para
//      client-side. Por ahora NO implementado — cuando el client-side
//      lo necesite, añadiremos.
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

async function _POST(request: NextRequest): Promise<NextResponse> {
  // ─── 1. Auth ──────────────────────────────────────────────
  const ingestSecret = request.headers.get('x-ingest-secret')
  const expected = process.env.OBSERVABILITY_INGEST_SECRET

  if (!expected) {
    // Misconfig de entorno — log a console (no a observable_events para
    // evitar loop si fuese el mismo problema)
    console.error(
      '❌ [observability/ingest] OBSERVABILITY_INGEST_SECRET no configurada — endpoint deshabilitado',
    )
    return NextResponse.json(
      { success: false, error: 'Endpoint mal configurado' },
      { status: 503 },
    )
  }

  if (ingestSecret !== expected) {
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
