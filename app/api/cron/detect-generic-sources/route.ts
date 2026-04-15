// app/api/cron/detect-generic-sources/route.ts
// Sensor generic_source: monitoriza fuentes estatales de Función Pública
// (DGFP, Secretaría Estado FP, Transparencia) que publican instrucciones,
// acuerdos, circulares NO siempre reflejados en BOE.
//
// Estrategia: hash SHA-256 del contenido limpio → compara con último check.
// Solo si el hash cambia, invoca Claude Haiku para filtrar contenido real
// relevante al temario. Evita 95% de falsos positivos cosméticos.
//
// Se ejecuta semanalmente (GitHub Actions lunes 8:00 UTC).

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { insertSignal } from '@/lib/api/oep-signals/queries'
import { baseScoreBySensor } from '@/lib/api/oep-signals/schemas'
import {
  fetchPageHtml,
  extractGenericSourceChanges,
  computeContentHash,
} from '@/lib/api/oep-signals/generic-source-extractor'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type SourceRow = {
  id: string
  source_key: string
  source_name: string
  source_url: string
  last_hash: string | null
  last_checked_at: string | null
}

async function _GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const db = getDb()

  const rows = (await db.execute(sql`
    SELECT id, source_key, source_name, source_url, last_hash, last_checked_at
    FROM generic_source_checks
    WHERE is_active = true
  `)) as unknown as { rows: SourceRow[] }

  const sources = rows.rows ?? (rows as unknown as SourceRow[])
  console.log(`🔍 [GenericSources] ${sources.length} fuentes a revisar`)

  const stats = { total: sources.length, checked: 0, hashChanged: 0, signals: 0, errors: 0 }
  const signalsCreated: Array<{ source: string; summary: string; itemCount: number }> = []
  const errors: Array<{ source: string; error: string }> = []

  for (const src of sources) {
    console.log(`  📄 ${src.source_name}`)
    stats.checked++

    const fetched = await fetchPageHtml(src.source_url, 20000)
    if (!fetched.html) {
      errors.push({ source: src.source_name, error: fetched.error ?? 'fetch failed' })
      stats.errors++
      continue
    }

    const newHash = computeContentHash(fetched.html)
    const now = new Date().toISOString()

    if (src.last_hash && src.last_hash === newHash) {
      console.log(`     ✓ Sin cambios`)
      await db.execute(sql`
        UPDATE generic_source_checks
        SET last_checked_at = ${now}, updated_at = ${now}
        WHERE id = ${src.id}
      `)
      continue
    }

    console.log(`     🔄 Hash cambió — invocando LLM para filtrar relevancia...`)
    stats.hashChanged++

    const extraction = await extractGenericSourceChanges(
      src.source_name,
      fetched.html,
      src.last_checked_at,
    )

    if (!extraction || !extraction.hasRelevantChange || extraction.items.length === 0) {
      console.log(`     ℹ️ LLM no detecta contenido normativo relevante (cambio cosmético)`)
      await db.execute(sql`
        UPDATE generic_source_checks
        SET last_hash = ${newHash}, last_checked_at = ${now}, updated_at = ${now}
        WHERE id = ${src.id}
      `)
      continue
    }

    // Señal relevante detectada
    const altaCount = extraction.items.filter(i => i.relevance === 'alta').length
    const score = Math.min(100, baseScoreBySensor('generic_source') + altaCount * 10)

    const summary = `${src.source_name}: ${extraction.summary} (${extraction.items.length} ítems, ${altaCount} alta relevancia)`
    const dedupeKey = `generic_source:${src.source_key}:${newHash.slice(0, 16)}`

    const { inserted, id: signalId } = await insertSignal({
      oposicionId: null,
      sensorType: 'generic_source',
      sourceUrl: src.source_url,
      confidenceScore: score,
      isNovel: true,
      signalSummary: summary,
      rawExtraction: { items: extraction.items, sourceName: src.source_name, sourceKey: src.source_key } as Record<string, unknown>,
      dedupeKey,
    })

    if (inserted) {
      console.log(`     🚨 SEÑAL generada score=${score}: ${summary}`)
      stats.signals++
      signalsCreated.push({ source: src.source_name, summary, itemCount: extraction.items.length })
      await db.execute(sql`
        UPDATE generic_source_checks
        SET last_hash = ${newHash}, last_checked_at = ${now}, last_changed_at = ${now},
            last_signal_id = ${signalId}, updated_at = ${now}
        WHERE id = ${src.id}
      `)
    } else {
      console.log(`     ⏭️ Señal duplicada (ya existe pending)`)
      await db.execute(sql`
        UPDATE generic_source_checks
        SET last_hash = ${newHash}, last_checked_at = ${now}, updated_at = ${now}
        WHERE id = ${src.id}
      `)
    }

    // Pausa entre fuentes (no saturar LLM)
    await new Promise(r => setTimeout(r, 1000))
  }

  const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
  console.log(`📊 [GenericSources] Completado en ${duration}:`, stats)

  return NextResponse.json({
    success: true,
    duration,
    stats,
    signals: signalsCreated,
    errors,
    timestamp: new Date().toISOString(),
  })
}

export const GET = withErrorLogging('/api/cron/detect-generic-sources', _GET)
