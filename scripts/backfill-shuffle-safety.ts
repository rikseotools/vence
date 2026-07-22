// Backfill DETERMINISTA de questions.shuffle_safety (barajar-opciones verificación robusta,
// Paso 1). Marca cada pregunta safe/unsafe con el detector determinista endurecido (la
// FUENTE de verdad de la lógica, no una copia). El hash lo calcula la función SQL en el
// mismo UPDATE → el trigger de invalidación NO lo marca stale acto seguido.
//
// Diseño: docs/roadmap/barajar-opciones-verificacion-robusta.md.
// Uso:  DATABASE_URL=... NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/backfill-shuffle-safety.ts [--dry]
//
// Reglas (sesgo 0-FN; un FP solo evita barajar, es inocuo):
//   shuffle_mode != 'full'                          -> unsafe  (reason 'mode_<modo>')
//   full  &&  la explicación cita letra/posición    -> unsafe  (reason 'explanation_refs_letters')
//   full  &&  explicación limpia                     -> safe    (reason 'deterministic_v3')
// La auditoría LLB (Paso 2) podrá luego bajar safe->unsafe; nunca al revés sin evidencia.
import { Client } from 'pg'
import { explanationReferencesLetters } from '@/lib/shuffle/classifyShuffleMode'

const DRY = process.argv.includes('--dry')
const BATCH = 1000
const VERIFIED_BY = 'backfill_deterministic_v3'

type Row = { id: string; explanation: string | null; shuffle_mode: string | null }

function verdict(r: Row): { state: 'safe' | 'unsafe'; reason: string } {
  if (r.shuffle_mode !== 'full') return { state: 'unsafe', reason: `mode_${r.shuffle_mode ?? 'null'}` }
  if (explanationReferencesLetters(r.explanation)) return { state: 'unsafe', reason: 'explanation_refs_letters' }
  return { state: 'safe', reason: 'deterministic_v3' }
}

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL!.replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // Solo las que aún no tienen veredicto determinista de esta versión (idempotente,
  // reanudable): unverified, o stale (contenido cambió), o verificadas por versión anterior.
  const rows = (
    await c.query(
      `SELECT id, explanation, shuffle_mode FROM public.questions
       WHERE is_active = true
         AND (shuffle_safety = 'unverified' OR shuffle_safety = 'stale'
              OR shuffle_safety_verified_by IS DISTINCT FROM $1)`,
      [VERIFIED_BY],
    )
  ).rows as Row[]

  console.log(`Preguntas a clasificar: ${rows.length}${DRY ? ' (DRY RUN)' : ''}`)
  const tally: Record<string, number> = {}
  const batches: Row[][] = []
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH))

  let done = 0
  for (const batch of batches) {
    // VALUES (id, state, reason) para el UPDATE ... FROM. El hash se calcula en SQL.
    const values: string[] = []
    const params: unknown[] = []
    let p = 1
    for (const r of batch) {
      const v = verdict(r)
      tally[`${v.state}:${v.reason}`] = (tally[`${v.state}:${v.reason}`] || 0) + 1
      values.push(`($${p++}::uuid, $${p++}::text, $${p++}::text)`)
      params.push(r.id, v.state, v.reason)
    }
    if (!DRY) {
      params.push(VERIFIED_BY)
      const sql = `
        UPDATE public.questions q
           SET shuffle_safety = v.state,
               shuffle_safety_reason = v.reason,
               shuffle_safety_hash = public.compute_shuffle_safety_hash(q.explanation, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.shuffle_mode),
               shuffle_safety_verified_at = now(),
               shuffle_safety_verified_by = $${p}::text
          FROM (VALUES ${values.join(',')}) AS v(id, state, reason)
         WHERE q.id = v.id`
      await c.query(sql, params)
    }
    done += batch.length
    if (done % 10000 < BATCH) console.log(`  ${done}/${rows.length}`)
  }

  console.log('Veredictos:')
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`)

  if (!DRY) {
    const dist = (await c.query(`SELECT shuffle_safety, count(*)::int n FROM public.questions GROUP BY 1 ORDER BY 2 DESC`)).rows
    console.log('Distribución final shuffle_safety:', dist)
  }
  await c.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
