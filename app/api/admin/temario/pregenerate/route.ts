// app/api/admin/temario/pregenerate/route.ts
//
// Dispara la PRE-GENERACIÓN offline de PDFs del temario → caché S3 (ver
// lib/temario/pdf/pregenerate.ts + pdfCache.ts). Es lo que hace descargables los temas
// GRANDES (Access/ofimática): se generan aquí (SIN el límite de 60s del ALB, en una promise
// desacoplada sobre el server largo de ECS) y el endpoint de descarga los sirve de S3.
//
// ACCESO: SOLO admin (requireAdmin). No expone contenido nuevo — solo lanza generación.
//
// Cuerpo (JSON):
//   { "targets": [{ "oposicion": "auxiliar-administrativo-madrid", "tema": 19 }, …], "force"?: bool }
// (La enumeración "todos los temas" la hace un cron/script aparte, que llama aquí con
//  targets[] en lotes — así el endpoint queda simple y sin acoplarse al schema.)
//
// Respuesta 202: { accepted: N, note }. La generación corre EN BACKGROUND; su
// progreso/resultado se observa en `observable_events` (eventType='temario_pdf_pregenerated').

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { pregenerateTopicPdf } from '@/lib/temario/pdf/pregenerate'
import { emitFireAndForget } from '@/lib/observability/emit'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Tope de seguridad: nunca aceptar un batch descomunal en una sola llamada.
const MAX_TARGETS = 4000

type Target = { oposicion: string; tema: number }

async function handler(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin.ok) return admin.response

  let body: { targets?: Target[]; force?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'json_invalido' }, { status: 400 })
  }

  if (!Array.isArray(body.targets) || body.targets.length === 0) {
    return NextResponse.json({ error: 'falta targets[]' }, { status: 400 })
  }
  const targets: Target[] = body.targets
    .filter((t) => t && typeof t.oposicion === 'string' && Number.isInteger(t.tema))
    .map((t) => ({ oposicion: t.oposicion, tema: t.tema }))

  if (targets.length === 0) return NextResponse.json({ error: 'sin_targets' }, { status: 400 })
  if (targets.length > MAX_TARGETS) {
    return NextResponse.json({ error: 'demasiados_targets', max: MAX_TARGETS, pedidos: targets.length }, { status: 413 })
  }

  const force = body.force === true

  // Generación EN BACKGROUND: promise desacoplada, SECUENCIAL (un render a la vez para no
  // saturar la CPU del contenedor). Devolvemos 202 ya; el progreso va a observable_events.
  // Sobre el server largo de ECS, esta promise sigue viva tras la respuesta (no es serverless).
  void (async () => {
    let uploaded = 0, skipped = 0, errored = 0
    const startedAt = Date.now()
    for (const t of targets) {
      const r = await pregenerateTopicPdf(t.oposicion, t.tema, { force })
      if (r.outcome === 'uploaded') uploaded++
      else if (r.outcome === 'skipped') skipped++
      else errored++
    }
    emitFireAndForget({
      source: 'fargate', severity: errored > 0 ? 'warn' : 'info',
      eventType: 'temario_pdf_pregenerate_batch', endpoint: '/api/admin/temario/pregenerate',
      metadata: { total: targets.length, uploaded, skipped, errored, ms: Date.now() - startedAt, force },
    })
  })()

  return NextResponse.json(
    { accepted: targets.length, force,
      note: 'Generando en background; sigue el progreso en observable_events (temario_pdf_pregenerated / _batch).' },
    { status: 202 },
  )
}

export const POST = withErrorLogging('/api/admin/temario/pregenerate', handler as never)
