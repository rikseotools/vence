// scripts/scope/sim-law-inclusion.ts
//
// SIMULACIÓN del fix B (feedback Alfonso 25/07). Replica su selección EXACTA del test
// multi-ley (laws=39/2015,40/2015 & articles=Ley 40/2015:32-36) con los CONTEOS REALES
// de preguntas de RDS y la pasa por el helper REAL (summarizeLawInclusion, sin duplicar
// lógica) para demostrar que:
//   1) 40/2015 entra ACOTADA (5 artículos) — correcto.
//   2) 39/2015 entra ENTERA (el usuario no lo acotó) — la sorpresa que reportó.
//   3) mixedWholeAndNarrowed=true → el aviso de la UI se dispara.
// Y contrasta con un caso SANO (ambas acotadas) → sin aviso.
//
// Uso: DATABASE_URL=… npx tsx scripts/scope/sim-law-inclusion.ts
import postgres from 'postgres'
import { summarizeLawInclusion } from '../../lib/laws/lawInclusionSummary'

const DBURL = process.env.DATABASE_URL
if (!DBURL) { console.error('Falta DATABASE_URL'); process.exit(1) }

const sql = postgres(DBURL, { ssl: { rejectUnauthorized: false }, max: 1 })

let failures = 0
function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

async function main() {
  // Conteos reales de preguntas activas por ley (pool si entra entera).
  const rows = await sql<{ short_name: string; display_name: string; n: number }[]>`
    SELECT l.short_name, l.name AS display_name, count(*)::int AS n
    FROM questions q JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE q.is_active AND l.short_name IN ('Ley 39/2015','Ley 40/2015')
    GROUP BY l.short_name, l.name`
  const lawsData = rows.map(r => ({
    law_short_name: r.short_name,
    display_name: r.display_name,
    questions_count: r.n,
    articles_with_questions: 0,
  }))
  console.log('Pools reales (ley entera):', rows.map(r => `${r.short_name}=${r.n}`).join(', '))

  // ── CASO ALFONSO (su URL real) ──
  console.log('\n── CASO ALFONSO: laws=39/2015,40/2015 · articles=Ley 40/2015:32-36 ──')
  const alfonso = summarizeLawInclusion({
    selectedLaws: ['Ley 39/2015', 'Ley 40/2015'],
    selectedArticlesByLaw: new Map([['Ley 40/2015', new Set(['32', '33', '34', '35', '36'])]]),
    selectedSectionFiltersCount: 0,
    lawsData,
  })
  alfonso.perLaw.forEach(l => console.log(`     ${l.lawShortName}: ${l.mode}${l.mode === 'whole' ? ` (${l.wholeQuestionsCount} preg)` : ` (${l.narrowedCount} arts)`}`))
  assert(alfonso.perLaw.find(l => l.lawShortName === 'Ley 40/2015')?.mode === 'articles', '40/2015 entra ACOTADA (articles)')
  assert(alfonso.perLaw.find(l => l.lawShortName === 'Ley 39/2015')?.mode === 'whole', '39/2015 entra ENTERA (whole) ← la sorpresa reportada')
  assert(alfonso.mixedWholeAndNarrowed === true, 'mixedWholeAndNarrowed=true → la UI muestra el aviso')
  assert(alfonso.wholeQuestionsTotal > 100, `el flood potencial es grande (${alfonso.wholeQuestionsTotal} preg de la ley entera)`)

  // ── CASO SANO: ambas acotadas → sin aviso ──
  console.log('\n── CASO SANO: ambas leyes acotadas a artículos ──')
  const sano = summarizeLawInclusion({
    selectedLaws: ['Ley 39/2015', 'Ley 40/2015'],
    selectedArticlesByLaw: new Map([
      ['Ley 39/2015', new Set(['13', '14'])],
      ['Ley 40/2015', new Set(['32', '33'])],
    ]),
    selectedSectionFiltersCount: 0,
    lawsData,
  })
  assert(sano.mixedWholeAndNarrowed === false, 'ambas acotadas → SIN aviso (no molesta cuando no toca)')
  assert(sano.wholeLaws.length === 0, 'ninguna ley entera')

  await sql.end()
  console.log(`\n${failures === 0 ? '✅ SIMULACIÓN OK' : `❌ ${failures} fallo(s)`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
