#!/usr/bin/env node
// ¿Alguna pregunta VIVA da por correcta una respuesta que reproduce un inciso ANULADO por el
// Tribunal Constitucional? (frase-gatillo "revisa los incisos anulados", segunda mitad).
//
// El detector hermano (`audit-annulled-provisions.cjs`) comprueba que el ARTÍCULO lleve nota
// de vigencia. Este mira lo que de verdad duele: que la CLAVE de una pregunta enseñe como
// válido algo que el TC anuló — el incidente fundacional (art. 126.2 LBRL / STC 103/2013).
//
//   node scripts/audit-clave-inciso-anulado.cjs [--json] [--emit] [--ley "Ley 7/1985"]
//
// Toda la lógica (y su calibración) vive en el núcleo PURO `lib/laws/claveConIncisoAnulado.js`.
// --emit escribe a observable_events (kind 'question_clave_inciso_anulado').
// NUNCA auto-corrige: la clave se toca con revisión humana (runbook incisos-anulados-tc.md).
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const { analizarClave } = require(path.join(__dirname, '..', 'lib', 'laws', 'claveConIncisoAnulado'))

function getUrl() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  const m = env.match(/^DATABASE_URL=(.*)$/m)
  return (m ? m[1] : '').trim().replace(/^["']|["']$/g, '').replace(/\?.*$/, '')
}

async function main() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }
  const JSON_OUT = process.argv.includes('--json')
  const EMIT = process.argv.includes('--emit')
  const LEY = arg('--ley')

  const c = new Client({ connectionString: getUrl(), ssl: { rejectUnauthorized: false } })
  await c.connect()

  // Solo artículos con inciso anulado LITERAL capturado y con preguntas vivas encima.
  const { rows } = await c.query(
    `SELECT l.short_name AS ley, a.article_number AS art,
            a.vigencia_notes->'annulledFragments' AS frags,
            q.id, q.question_text,
            CASE q.correct_option WHEN 0 THEN q.option_a WHEN 1 THEN q.option_b
                                  WHEN 2 THEN q.option_c ELSE q.option_d END AS clave
       FROM articles a
       JOIN laws l ON l.id = a.law_id
       JOIN questions q ON q.primary_article_id = a.id AND q.is_active
      WHERE jsonb_array_length(a.vigencia_notes->'annulledFragments') > 0
        ${LEY ? 'AND l.short_name = $1' : ''}
      ORDER BY l.short_name, a.article_number`,
    LEY ? [LEY] : [],
  )

  const hallazgos = []
  for (const r of rows) {
    const v = analizarClave(r.clave, r.frags)
    if (!v.hallazgo) continue
    hallazgos.push({
      ley: r.ley, articulo: r.art, banda: v.banda, fragmento: v.fragmento,
      question_id: r.id, enunciado: String(r.question_text).slice(0, 120), clave: String(r.clave).slice(0, 160),
    })
  }

  if (EMIT && hallazgos.length) {
    for (const h of hallazgos) {
      await c.query(
        `INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
         VALUES ('cli', $1, 'question_clave_inciso_anulado', 'audit-clave-inciso-anulado', $2::jsonb)`,
        [h.banda === 'alta' ? 'error' : 'warn', JSON.stringify(h)],
      )
    }
  }
  await c.end()

  if (JSON_OUT) {
    console.log(JSON.stringify({ preguntasComprobadas: rows.length, hallazgos }, null, 2))
  } else {
    console.log(`\n=== Claves que reproducen un inciso anulado por el TC ===`)
    console.log(`preguntas vivas comprobadas (artículos con inciso literal): ${rows.length}`)
    const alta = hallazgos.filter((h) => h.banda === 'alta')
    const rev = hallazgos.filter((h) => h.banda === 'revisar')
    console.log(`🚩 banda ALTA (fragmento distintivo): ${alta.length}`)
    for (const h of alta) console.log(`  • ${h.ley} art.${h.articulo} [${h.question_id.slice(0, 8)}] «${h.fragmento.slice(0, 60)}»\n    ✔ ${h.clave}`)
    console.log(`🟡 banda REVISAR (fragmento corto, puede ser coincidencia): ${rev.length}`)
    for (const h of rev) console.log(`  • ${h.ley} art.${h.articulo} [${h.question_id.slice(0, 8)}] «${h.fragmento}»\n    ✔ ${h.clave}`)
    if (!hallazgos.length) console.log('\n✅ ninguna clave reproduce un inciso anulado')
  }
  process.exit(process.argv.includes('--gate') && hallazgos.some((h) => h.banda === 'alta') ? 1 : 0)
}

if (require.main === module) {
  main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
}
