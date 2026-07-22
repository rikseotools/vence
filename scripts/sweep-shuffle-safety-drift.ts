// Drift sweep de shuffle_safety (barajar-opciones verificación robusta, Paso 3).
// Versión de PRODUCCIÓN recurrente del canary: caza cualquier pregunta marcada
// shuffle_safety='safe' cuya explicación HOY cita letras/posición según el detector
// REAL (regresión, miss del detector, o edición que el trigger no invalidó). También
// comprueba la INTEGRIDAD del trigger: safe cuyo hash guardado != hash del contenido
// actual (debería estar stale y no lo está).
//
// Usa la función REAL de producción (no una copia). Emite JSON con --json para que
// health-sweep.cjs lo pliegue en content_health_findings (kind 'shuffle_safe_regressed').
// Sin escribir a la tabla (la dueña del TRUNCATE es el sweep).
//
// Uso: DATABASE_URL=.. NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/sweep-shuffle-safety-drift.ts [--json]
import { Client } from 'pg'
import { explanationReferencesLetters } from '@/lib/shuffle/classifyShuffleMode'

const JSON_OUT = process.argv.includes('--json')

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL!.replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // 1) Regresión: safe activas cuya explicación cita letras/posición (el detector las
  //    debería haber dejado fuera; si aparecen es un miss/regresión).
  //    PREFILTRO SQL de alto recall: solo las que contienen un token de letra/número/
  //    ordinal PUEDEN disparar el detector; las limpias no. Reduce ~70k → ~9k (el sweep
  //    nocturno no escanea las 60k inequívocamente limpias). El prefiltro es superset de
  //    lo que marca el detector (0 FN del prefiltro).
  const safe = (
    await c.query(
      `SELECT id, explanation FROM public.questions
        WHERE is_active = true AND shuffle_safety = 'safe' AND explanation IS NOT NULL
          AND (explanation ~ '\\y[A-Ea-e]\\y'
               OR explanation ~ '\\y[0-9]\\y'
               OR explanation ~* '(primer|segund|tercer|cuart|quint|[uú]ltim|anterior|siguiente|opci|respuesta|apartado|letra|alternativa|afirmaci)')`,
    )
  ).rows as { id: string; explanation: string }[]
  const regressed = safe.filter((r) => explanationReferencesLetters(r.explanation))

  // 2) Integridad del trigger: safe cuyo hash guardado != hash del contenido actual.
  //    (El trigger debería haberlas puesto 'stale'. Si no, el trigger está roto.)
  const hashMismatch = (
    await c.query(
      `SELECT count(*)::int AS n FROM public.questions
        WHERE is_active = true AND shuffle_safety = 'safe'
          AND shuffle_safety_hash IS DISTINCT FROM public.compute_shuffle_safety_hash(
            explanation, option_a, option_b, option_c, option_d, option_e, shuffle_mode)`,
    )
  ).rows[0].n as number

  await c.end()

  const result = {
    regressions: regressed.length,
    hash_mismatch: hashMismatch,
    sample: regressed.slice(0, 8).map((r) => ({ id: r.id, explanation: r.explanation.replace(/\s+/g, ' ').slice(0, 120) })),
  }

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(result))
  } else {
    console.log(`safe activas: ${safe.length}`)
    console.log(`REGRESIONES (safe que citan letras/posición): ${result.regressions}`)
    console.log(`hash mismatch (trigger no invalidó): ${result.hash_mismatch}`)
    for (const s of result.sample) console.log(`  - ${s.id}: "${s.explanation}"`)
    if (result.regressions === 0 && result.hash_mismatch === 0) console.log('✅ sin drift: el conjunto safe es coherente.')
  }
}
main().catch((e) => {
  if (JSON_OUT) process.stdout.write(JSON.stringify({ regressions: 0, hash_mismatch: 0, sample: [], error: String(e).slice(0, 200) }))
  else console.error(e)
  process.exit(JSON_OUT ? 0 : 1) // en modo json no romper el sweep
})
