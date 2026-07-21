#!/usr/bin/env node
/**
 * backfill-hito-source-documento.cjs — enlaza hitos a su documento clonado por
 * COINCIDENCIA EXACTA DE URL, sin ningún fetch externo.
 *
 * Contexto: la provenance (hito → documento clonado, vía `source_documento_id`)
 * estaba casi vacía (18/1044). De los hitos con url sin enlace, una parte YA
 * tiene su documento clonado en la misma convocatoria (mismo `url`) — solo falta
 * el enlace. Esto lo cierra de forma DETERMINISTA (cero invención, cero red).
 * Los que NO tienen documento clonado (docs_por_clonar) los ve la vista
 * `convocatoria_docs_coverage` y son otro trabajo (clonar contra fuente oficial).
 *
 * Robusto:
 *  - IDEMPOTENTE: solo toca hitos con source_documento_id IS NULL.
 *  - DETERMINISTA: si la url coincide con >1 documento, elige el más antiguo
 *    (ORDER BY created_at, id) — resultado estable entre pasadas.
 *  - DRY-RUN por defecto: no escribe salvo `--apply`.
 *  - Transaccional en modo apply.
 *
 * Uso:
 *   node scripts/backfill-hito-source-documento.cjs          # dry-run (reporta)
 *   node scripts/backfill-hito-source-documento.cjs --apply  # aplica
 */
const fs = require('fs')
const path = require('path')

function loadDbUrl() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const m = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)
  if (!m) throw new Error('DATABASE_URL no encontrada en .env.local')
  return m[1].trim()
}

// pg driver: usar el de backend (mismo que el resto de scripts .cjs de ops)
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))

const APPLY = process.argv.includes('--apply')

async function main() {
  const sql = pg(loadDbUrl(), { ssl: { rejectUnauthorized: false }, max: 1 })
  try {
    // Candidatos: hito sin enlace, con url, cuya url coincide con un documento
    // clonado de la MISMA convocatoria.
    const candidatos = await sql`
      SELECT count(*)::int n
      FROM convocatoria_hitos h
      WHERE h.source_documento_id IS NULL
        AND h.url IS NOT NULL
        AND h.convocatoria_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM convocatoria_documentos d
          WHERE d.convocatoria_id = h.convocatoria_id AND d.url = h.url
        )`
    const n = candidatos[0].n
    console.log(`Hitos enlazables por URL (source_documento_id NULL + doc clonado con misma url): ${n}`)

    if (!APPLY) {
      console.log('DRY-RUN: no se escribe nada. Reintenta con --apply para enlazar.')
      // muestra una muestra para inspección
      const sample = await sql`
        SELECT h.id hito, left(h.titulo,40) titulo, h.url
        FROM convocatoria_hitos h
        WHERE h.source_documento_id IS NULL AND h.url IS NOT NULL AND h.convocatoria_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM convocatoria_documentos d WHERE d.convocatoria_id=h.convocatoria_id AND d.url=h.url)
        LIMIT 5`
      for (const s of sample) console.log('  •', s.titulo.padEnd(42), s.url.slice(0, 60))
      return
    }

    const updated = await sql.begin(async (t) => {
      const r = await t`
        UPDATE convocatoria_hitos h
        SET source_documento_id = (
          SELECT d.id FROM convocatoria_documentos d
          WHERE d.convocatoria_id = h.convocatoria_id AND d.url = h.url
          ORDER BY d.created_at NULLS LAST, d.id
          LIMIT 1
        )
        WHERE h.source_documento_id IS NULL
          AND h.url IS NOT NULL
          AND h.convocatoria_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM convocatoria_documentos d
            WHERE d.convocatoria_id = h.convocatoria_id AND d.url = h.url
          )
        RETURNING h.id`
      return r.length
    })
    console.log(`✅ Enlazados ${updated} hitos a su documento clonado.`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
