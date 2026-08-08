// Backfill DETERMINISTA de questions.shuffle_safety (barajar-opciones verificación robusta,
// Paso 1). Marca cada pregunta safe/unsafe con el detector determinista endurecido (la
// FUENTE de verdad de la lógica, no una copia). El hash lo calcula la función SQL en el
// mismo UPDATE → el trigger de invalidación NO lo marca stale acto seguido.
//
// Diseño: docs/roadmap/barajar-opciones-verificacion-robusta.md.
// Uso:  DATABASE_URL=... NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/backfill-shuffle-safety.ts [--dry]
//       … scripts/backfill-shuffle-safety.ts --recriterio [--apply] [--max N]   (ver abajo)
//
// Reglas (sesgo 0-FN; un FP solo evita barajar, es inocuo):
//   shuffle_mode != 'full'                          -> unsafe  (reason 'mode_<modo>')
//   full  &&  la explicación cita letra/posición    -> unsafe  (reason 'explanation_refs_letters')
//   full  &&  explicación limpia                     -> safe    (reason 'deterministic_v3')
// La auditoría LLB (Paso 2) podrá luego bajar safe->unsafe; nunca al revés sin evidencia.
//
// ── MODO `--recriterio` (T-306, 30/07/2026): re-evaluar cuando cambia el CRITERIO ──────────────
// El trigger de invalidación mira el hash del CONTENIDO. Cuando lo que cambia es el detector
// —y van cuatro calibraciones: tildes 28/07, «la Cámara» y los grados centígrados 30/07— el
// contenido es idéntico, el hash es idéntico, y el veredicto viejo se queda escrito para siempre.
// Medido con el fix de los grados (T-301): 106 activas dejaron de estar marcadas y NINGUNA cambió
// de estado. El arreglo del detector era inerte.
//
// Este modo re-evalúa SOLO los veredictos que firmó este mismo script
// (`shuffle_safety_verified_by = 'backfill_deterministic_v3'`). Nunca toca los de `llm_audit_v1`
// ni los de `aplicar-explicacion`: esa es exactamente la regresión del 22/07 (re-procesar lo ya
// clasificado deshacía las bajadas de la auditoría LLM), y aquí se respeta por SQL, no por
// disciplina. Escribe por `record_shuffle_safety`, que deja fila en
// `question_shuffle_safety_history` — un cambio de criterio tiene que ser auditable.
// DRY por defecto: sin `--apply` no escribe nada.
import { Client } from 'pg'
import { explanationReferencesLetters } from '@/lib/shuffle/classifyShuffleMode'

const DRY = process.argv.includes('--dry')
const RECRITERIO = process.argv.includes('--recriterio')
const APPLY = process.argv.includes('--apply')
// `--max N`: techo de cambios que se aceptan sin revisar (ver el guardarraíl de volumen abajo).
// Sin la bandera, 2000. Ojo: `indexOf` da -1 cuando no está, y `argv[0]` es la ruta de node —
// leerlo sin comprobar daba NaN y el guardarraíl abortaba SIEMPRE (visto en el primer dry-run).
const I_MAX = process.argv.indexOf('--max')
const MAX = I_MAX >= 0 ? Number(process.argv[I_MAX + 1]) : 2000
const BATCH = 1000
const VERIFIED_BY = 'backfill_deterministic_v3'

type Row = { id: string; explanation: string | null; shuffle_mode: string | null }

function verdict(r: Row): { state: 'safe' | 'unsafe'; reason: string } {
  if (r.shuffle_mode !== 'full') return { state: 'unsafe', reason: `mode_${r.shuffle_mode ?? 'null'}` }
  if (explanationReferencesLetters(r.explanation)) return { state: 'unsafe', reason: 'explanation_refs_letters' }
  return { state: 'safe', reason: 'deterministic_v3' }
}

/**
 * Re-evalúa los veredictos PROPIOS tras un cambio de criterio. Devuelve el nº de cambios.
 *
 * Acotado por SQL a `shuffle_safety_verified_by = VERIFIED_BY`: si mañana la auditoría LLM baja
 * una a `unsafe`, su `verified_by` pasa a `llm_audit_v1` y este modo deja de verla — que es la
 * garantía que pedía el diseño (el determinista es la 1ª capa y no pisa a la 2ª).
 */
async function recriterio(c: Client): Promise<number> {
  const rows = (
    await c.query(
      `SELECT id, explanation, shuffle_mode, shuffle_safety FROM public.questions
        WHERE is_active = true
          AND shuffle_safety IN ('safe','unsafe')
          AND shuffle_safety_verified_by = $1`,
      [VERIFIED_BY],
    )
  ).rows as Array<Row & { shuffle_safety: string }>

  const cambios = rows
    .map((r) => ({ r, v: verdict(r) }))
    .filter(({ r, v }) => v.state !== r.shuffle_safety)

  const dir = (a: string, b: string) => cambios.filter(({ r, v }) => r.shuffle_safety === a && v.state === b).length
  console.log(`\n== Re-evaluación por CAMBIO DE CRITERIO ${APPLY ? '' : '(DRY RUN — repite con --apply)'} ==`)
  console.log(`veredictos propios revisados: ${rows.length}`)
  console.log(`cambian: ${cambios.length}   (unsafe→safe ${dir('unsafe', 'safe')} · safe→unsafe ${dir('safe', 'unsafe')})`)
  for (const { r, v } of cambios.slice(0, 8)) {
    console.log(`  · ${r.id}  ${r.shuffle_safety} → ${v.state} (${v.reason})`)
  }
  if (!cambios.length) return 0

  // Guardarraíl de VOLUMEN: un criterio que de golpe mueve miles de filas es más probablemente un
  // detector roto que una mejora. Se para y se pide confirmación explícita en vez de escribir.
  if (!Number.isFinite(MAX) || cambios.length > MAX) {
    console.error(
      `\n❌ ${cambios.length} cambios supera el máximo de ${MAX}. Revisa el detector antes de aplicar;` +
        ` si es legítimo, sube el techo con --max <n>.`,
    )
    process.exit(1)
  }
  if (!APPLY) return cambios.length

  for (const { r, v } of cambios) {
    await c.query(`SELECT record_shuffle_safety($1::uuid, $2::text, $3::text, $4::text)`, [
      r.id,
      v.state,
      v.reason,
      VERIFIED_BY,
    ])
  }
  try {
    await c.query(
      `INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
       VALUES (gen_random_uuid(), NOW(), 'script:backfill-shuffle-safety', 'info', 'shuffle_safety_recriterio',
               $1::jsonb, NOW())`,
      [JSON.stringify({ revisadas: rows.length, cambios: cambios.length, unsafe_a_safe: dir('unsafe', 'safe'), safe_a_unsafe: dir('safe', 'unsafe') })],
    )
  } catch (e) {
    console.error(`⚠️  no se pudo registrar el evento: ${(e as Error).message}`)
  }
  console.log(`\n✅ ${cambios.length} veredictos re-escritos (con fila en question_shuffle_safety_history).`)
  return cambios.length
}

async function main() {
  const { pgConfig } = await import('../lib/db/pgSsl.cjs')
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  if (RECRITERIO) {
    await recriterio(c)
    await c.end()
    return
  }

  // SOLO clasifica lo NO clasificado o invalidado: unverified (nunca) o stale (el trigger
  // detectó cambio de contenido). NUNCA re-procesa filas ya safe/unsafe — podrían tener un
  // veredicto MÁS AUTORITATIVO de la auditoría LLM (verified_by='llm_audit_v1'), y este
  // backfill es solo la 1ª capa (determinista). [Regresión 22/07 corregida: la condición
  // anterior `verified_by != 'backfill_deterministic_v3'` re-seleccionaba las LLM-auditadas
  // y deshacía sus bajadas; se restauró desde question_shuffle_safety_history.]
  const rows = (
    await c.query(
      `SELECT id, explanation, shuffle_mode FROM public.questions
       WHERE is_active = true AND shuffle_safety IN ('unverified','stale')`,
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
               shuffle_safety_hash = public.compute_shuffle_safety_hash(q.explanation, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.shuffle_mode, q.explanation_data::text),
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
