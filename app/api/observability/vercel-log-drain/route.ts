// app/api/observability/vercel-log-drain/route.ts
//
// HTTP receptor de Vercel Log Drains — Gap 14 del manual observability.md.
//
// Vercel mata lambdas con SIGTERM cuando exceden `maxDuration` (504 Runtime
// Timeout). El código de app NUNCA puede capturarlo: la lambda muere antes
// de retornar response, ningún wrapper ve el status. Único modo de tener
// visibilidad: que Vercel mismo emita los logs HTTP del edge a este
// endpoint vía HTTPS Log Drain.
//
// Configuración en Vercel UI (paso operativo, no automatizable):
//   Settings → Log Drains → Add → HTTPS
//     URL: https://www.vence.es/api/observability/vercel-log-drain
//     Custom Headers: x-ingest-secret: <OBSERVABILITY_INGEST_SECRET>
//     Sources: lambda, edge (omitimos 'static' para evitar ruido)
//     Project: vence (solo este)
//     Format: ndjson (preferido) o json (legacy)
//
// El handler reutiliza el mismo secret que `/api/observability/ingest`
// para evitar proliferación de env vars. Si en el futuro queremos rotar
// por separado, se añadirá `OBSERVABILITY_VERCEL_DRAIN_SECRET` opcional.

import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { emit } from '@/lib/observability/emit'
import {
  parseVercelLogBody,
  shouldPersist,
  toObservableEvent,
} from '@/lib/observability/vercel-log-drain'

// Drain envía batches pequeños (Vercel chunca por defecto). 10s sobra y
// evita que un drain lento (Vercel side) bloquee la lambda.
export const maxDuration = 10

async function _POST(request: NextRequest): Promise<NextResponse> {
  // ─── 1. Auth ──────────────────────────────────────────────
  const secret = request.headers.get('x-ingest-secret')
  const expected = process.env.OBSERVABILITY_INGEST_SECRET
  if (!expected) {
    // Misconfiguración del servidor — devolver 503 (no autenticamos
    // contra string vacío para evitar bypass accidental).
    return NextResponse.json(
      { success: false, error: 'OBSERVABILITY_INGEST_SECRET no configurado' },
      { status: 503 },
    )
  }
  if (secret !== expected) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // ─── 2. Leer y parsear body ───────────────────────────────
  // Vercel puede mandar NDJSON o JSON array. parseVercelLogBody tolera
  // ambos y es resiliente a líneas malformadas.
  const rawBody = await request.text()
  const entries = parseVercelLogBody(rawBody)
  if (entries.length === 0) {
    // Body vacío o no parseable — responder 200 igualmente: Vercel
    // reintentaría con backoff si devolvemos error, sobrecargando.
    return NextResponse.json({ success: true, received: 0, persisted: 0 })
  }

  // ─── 3. Filtrar relevantes + emitir ───────────────────────
  // shouldPersist deja pasar ≥400 y level=error/warn. El resto es ruido
  // de éxito (ya cubierto por sampling 10% en withErrorLogging).
  let persisted = 0
  for (const entry of entries) {
    if (!shouldPersist(entry)) continue
    try {
      // await emit en lugar de fire-and-forget: el batch es pequeño
      // (1-50 entries) y queremos garantizar persistencia antes de
      // devolver 200 a Vercel (que asume at-least-once delivery).
      await emit(toObservableEvent(entry))
      persisted++
    } catch (err) {
      // emit() ya tiene try/catch interno — esto es defensivo. NO
      // propagar: si una fila falla, el resto del batch debe persistir.
      console.warn(
        '[vercel-log-drain] emit falló para una entry:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  return NextResponse.json({
    success: true,
    received: entries.length,
    persisted,
    skipped: entries.length - persisted,
  })
}

export const POST = withErrorLogging('/api/observability/vercel-log-drain', _POST)
