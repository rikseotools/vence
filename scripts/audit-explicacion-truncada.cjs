#!/usr/bin/env node
/**
 * Explicaciones activas CORTADAS a mitad de frase (T-250). SOLO LEE.
 *
 *   npm run audit:explicacion-truncada            # informe
 *   npm run audit:explicacion-truncada -- --json  # para tuberías
 *   npm run audit:explicacion-truncada -- --muestra 20   # muestra aleatoria, para re-calibrar
 *
 * El juicio lo pone el núcleo puro `lib/health/explicacionTruncada.cjs`; aquí solo se traen las
 * filas y se agrupa. La consulta NO intenta filtrar por SQL a propósito: el criterio es gramatical
 * (la última palabra pide continuación) y meterlo en una expresión regular de Postgres fue
 * exactamente lo que produjo las 8.938 falsas alarmas de la heurística anterior.
 */
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const { Client } = require('pg')
const { clasificaTruncada } = require('../lib/health/explicacionTruncada.cjs')

async function main() {
  const json = process.argv.includes('--json')
  const iMuestra = process.argv.indexOf('--muestra')
  const muestra = iMuestra >= 0 ? Number(process.argv[iMuestra + 1] || 20) : 0

  const c = new Client(pgConfig())
  await c.connect()
  const { rows } = await c.query(`
    SELECT q.id, right(q.explanation, 220) AS cola, l.short_name AS ley,
           coalesce(e.impresiones, 0)::int AS impresiones
      FROM questions q
      LEFT JOIN articles a ON a.id = q.primary_article_id
      LEFT JOIN laws l ON l.id = a.law_id
      LEFT JOIN (
        SELECT question_id, count(*) AS impresiones FROM test_questions
         WHERE created_at > now() - interval '90 days' GROUP BY 1
      ) e ON e.question_id = q.id
     WHERE q.is_active AND q.explanation IS NOT NULL AND length(trim(q.explanation)) > 0`)
  await c.end()

  const hits = []
  for (const r of rows) {
    const v = clasificaTruncada({ explanation: r.cola })
    if (v.truncada) hits.push({ id: r.id, motivo: v.motivo, cola: v.cola, ley: r.ley, impresiones: r.impresiones })
  }
  hits.sort((a, b) => b.impresiones - a.impresiones)

  if (json) { console.log(JSON.stringify({ revisadas: rows.length, hallazgos: hits }, null, 2)); return }

  const porMotivo = hits.reduce((acc, h) => ({ ...acc, [h.motivo]: (acc[h.motivo] || 0) + 1 }), {})
  console.log(`\n📏 Explicaciones cortadas a mitad de frase`)
  console.log(`   revisadas: ${rows.length} activas con explicación`)
  console.log(`   cortadas:  ${hits.length}  (${Object.entries(porMotivo).map(([k, v]) => `${k}=${v}`).join(' · ')})`)
  console.log(`   exposición acumulada en 90 días: ${hits.reduce((s, h) => s + h.impresiones, 0)} impresiones\n`)

  if (muestra) {
    // Muestra determinista (sin Math.random, que rompería la reproducibilidad de la calibración).
    const mez = hits.slice()
    for (let i = mez.length - 1; i > 0; i--) { const j = (i * 7919) % (i + 1); [mez[i], mez[j]] = [mez[j], mez[i]] }
    console.log(`— MUESTRA ALEATORIA DE ${muestra} para juzgar precisión a mano —`)
    mez.slice(0, muestra).forEach((h, n) => console.log(`${String(n + 1).padStart(2)}. [${h.motivo}] ${h.id.slice(0, 8)} …${h.cola.slice(-90)}`))
    return
  }

  console.log('— las 15 de más exposición —')
  hits.slice(0, 15).forEach((h) => console.log(`  ${String(h.impresiones).padStart(5)} impr · ${h.id.slice(0, 8)} · ${h.ley || '—'} · …${h.cola.slice(-70)}`))
  console.log('\n(solo lee; para re-calibrar: --muestra 20)')
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
