// Métrica de éxito del barajado (verificación robusta, Paso 3b): BASELINE del sesgo
// "posición de la correcta ↔ acierto", para medir el impacto ANTES vs DESPUÉS del piloto.
//
// Hipótesis: sin barajar, los usuarios memorizan la POSICIÓN de la correcta (no el
// contenido) → en repeticiones aciertan de más. Barajar debe (a) aplanar la accuracy por
// posición de la correcta, y (b) BAJAR el "lift" de acierto en repeticiones.
//
// Solo lee (test_questions). Correr pre-piloto (baseline) y post-piloto (comparar).
// Diseño: docs/roadmap/barajar-opciones-verificacion-robusta.md.
// Uso: DATABASE_URL=.. NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/metric-shuffle-position-bias.ts [--days=90]
import { Pool } from 'pg'

const DAYS = Number((process.argv.find((a) => a.startsWith('--days=')) || '').split('=')[1] || 90)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!.replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  pool.on('error', () => {})
  const q = (t: string, p?: unknown[]) => pool.query(t, p)
  const since = `now() - interval '${DAYS} days'`

  // Solo legislativas con clave y usuario (las que pasan por el barajado).
  const base = `test_questions WHERE question_id IS NOT NULL AND created_at >= ${since}`

  console.log(`\n=== BASELINE sesgo posición↔acierto (últimos ${DAYS} días) ===`)

  // 1) Reparto de la POSICIÓN de la correcta (correct_answer) + accuracy por posición.
  //    Un skew de accuracy por letra sugiere que la posición influye (sesgo a aplanar).
  // Normalizamos a mayúscula (el modo examen guarda letras minúsculas) y excluimos blancos
  // para que el spread mida POSICIÓN, no el modo (examen es más difícil, confundía el dato).
  const byPos = (
    await q(`SELECT upper(correct_answer) AS pos, count(*)::int n, avg(is_correct::int)::float acc
             FROM ${base} AND correct_answer ~ '^[A-Ea-e]$' GROUP BY 1 ORDER BY 1`)
  ).rows as { pos: string; n: number; acc: number }[]
  const totalN = byPos.reduce((s, r) => s + r.n, 0)
  console.log(`\n[1] Accuracy por POSICIÓN de la opción correcta (n=${totalN.toLocaleString()}):`)
  for (const r of byPos) console.log(`   ${r.pos}: ${pct(r.acc)} acc  ·  ${pct(r.n / totalN)} de las preguntas`)
  // Spread solo sobre posiciones con datos reales (E suele tener ~0 exposiciones).
  const accs = byPos.filter((r) => r.n > totalN * 0.01).map((r) => r.acc)
  const spread = Math.max(...accs) - Math.min(...accs)
  console.log(`   → spread de accuracy entre posiciones con datos: ${pct(spread)} (barajar debería mantenerlo bajo; el sesgo fuerte está en las REPETICIONES, ver [2])`)

  // 2) LIFT en repeticiones: 1er intento vs intentos posteriores de la MISMA (user,question).
  //    El lift mezcla aprendizaje real + memorización de posición; barajar debe recortar
  //    la parte de posición.
  const rep = (
    await q(`
      WITH att AS (
        SELECT user_id, question_id, is_correct,
               row_number() OVER (PARTITION BY user_id, question_id ORDER BY created_at) AS attempt
        FROM ${base} AND user_id IS NOT NULL)
      SELECT (attempt = 1) AS first_try, count(*)::int n, avg(is_correct::int)::float acc
      FROM att GROUP BY 1`)
  ).rows as { first_try: boolean; n: number; acc: number }[]
  const first = rep.find((r) => r.first_try)
  const later = rep.find((r) => !r.first_try)
  console.log('\n[2] Acierto 1er intento vs repeticiones (misma pregunta, mismo usuario):')
  if (first) console.log(`   1er intento:   ${pct(first.acc)} (n=${first.n.toLocaleString()})`)
  if (later) console.log(`   repeticiones:  ${pct(later.acc)} (n=${later.n.toLocaleString()})`)
  if (first && later) console.log(`   → LIFT en repetición: +${pct(later.acc - first.acc)} (barajar debería reducirlo)`)

  // 3) Cobertura barajable: cuántas exposiciones caen sobre preguntas hoy 'safe'.
  const cov = (
    await q(`SELECT q.shuffle_safety, count(*)::int n
             FROM test_questions t
             JOIN questions q ON q.id = t.question_id
             WHERE t.question_id IS NOT NULL AND t.created_at >= ${since}
             GROUP BY 1 ORDER BY 2 DESC`)
  ).rows as { shuffle_safety: string; n: number }[]
  const covTotal = cov.reduce((s, r) => s + r.n, 0)
  const safeCov = cov.find((r) => r.shuffle_safety === 'safe')?.n || 0
  console.log('\n[3] Cobertura: exposiciones sobre preguntas barajables (safe):')
  console.log(`   ${pct(safeCov / Math.max(1, covTotal))} de las exposiciones son de preguntas 'safe' (se barajarían al encender)`)

  console.log('\n(Baseline guardado en la salida. Re-correr tras el piloto y comparar [1] spread y [2] lift.)')
  await pool.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
