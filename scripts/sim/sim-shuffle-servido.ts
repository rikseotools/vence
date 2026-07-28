#!/usr/bin/env npx tsx
/**
 * ¿Se BARAJA de verdad una pregunta concreta al servirla? Simulación con datos REALES.
 *
 * Contexto (28/07/2026): el piloto de barajado está encendido para
 * `auxiliar_administrativo_valencia`, pero `test_questions.option_order` sigue en 0 filas en TODA
 * la historia de la tabla. O no se baraja nunca, o el orden no vuelve al guardar — y son dos bugs
 * MUY distintos: el segundo significa que el servidor corrige la letra MOSTRADA contra la clave
 * ORIGINAL y apunta fallos falsos.
 *
 * Esto no razona sobre el código: coge las preguntas reales de la BD y las pasa por la MISMA
 * función de elegibilidad que usa el endpoint (`isShuffleServeEligible`), replicando el mismo
 * `permutationFor` para ver qué orden y qué clave mostrada saldrían.
 *
 * Uso:  npx tsx scripts/sim/sim-shuffle-servido.ts <prefijo-id> [prefijo-id...]
 */
import postgres from 'postgres'
import { isShuffleServeEligible } from '../../lib/shuffle/classifyShuffleMode'
import { permutationFor, applyOrder } from '../../lib/shuffle/permute'
import { isStructuredExplanation } from '../../lib/shuffle/structuredExplanation'

const PREFIJOS = process.argv.slice(2).length ? process.argv.slice(2) : ['694106ce', '4a56a4ca', '38915f80']

async function main() {
  const sql = postgres(process.env.DATABASE_URL as string, { ssl: { rejectUnauthorized: false }, max: 1 })
  let barajables = 0

  for (const pref of PREFIJOS) {
    const [q] = await sql`
      SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option,
             explanation, explanation_data, shuffle_mode, shuffle_safety
        FROM questions WHERE id::text LIKE ${pref + '%'} LIMIT 1`
    if (!q) { console.log(`\n── ${pref}: no existe`); continue }

    const naturales = [q.option_a, q.option_b, q.option_c, q.option_d].filter(
      (v: unknown): v is string => v != null && v !== '',
    )
    const estructurada = isStructuredExplanation(q.explanation_data, naturales.length)
      ? (q.explanation_data as { options?: Record<string, unknown> })
      : null

    const elegible = isShuffleServeEligible({
      shuffle_mode: q.shuffle_mode,
      explanation: q.explanation,
      shuffle_safety: q.shuffle_safety,
      has_structured_explanation: estructurada !== null,
      options: naturales,
      structuredReasons: estructurada
        ? (Object.values(estructurada.options ?? {}) as (string | null | undefined)[])
        : undefined,
    })

    console.log(`\n── ${pref} · safety=${q.shuffle_safety} · modo=${q.shuffle_mode} · opciones=${naturales.length}`)
    console.log(`   clave original: ${'ABCD'[q.correct_option]}`)
    console.log(`   ¿ELEGIBLE para barajar al servir? ${elegible ? 'SÍ' : 'NO'}`)

    if (elegible) {
      barajables++
      // Mismo mecanismo que el endpoint: permutación por (id, nonce). El nonce es aleatorio por
      // exposición, así que aquí se fija uno para poder ENSEÑAR el efecto de forma reproducible.
      const order = permutationFor(q.id, 'nonce-de-simulacion', naturales.length)
      const mostrada = order.indexOf(q.correct_option)
      console.log(`   orden servido: ${JSON.stringify(order)}  → la correcta se muestra en la posición ${'ABCD'[mostrada]}`)
      console.log(`   ⇒ el cliente valida contra "${'ABCD'[mostrada]}" y el servidor, si NO recibe el orden, corrige contra "${'ABCD'[q.correct_option]}"`)
      if (mostrada !== q.correct_option) {
        console.log(`   ⚠️ con este orden, quien acierte quedaría registrado como FALLO si el orden no viaja al guardar`)
      }
      const opts = applyOrder(naturales, order)
      console.log(`   primera opción mostrada: "${String(opts[0]).slice(0, 60)}"`)
    }
  }

  console.log(`\n▶ ${barajables}/${PREFIJOS.length} elegibles para barajar.`)
  console.log(
    barajables === 0
      ? '  → Si NINGUNA es elegible, el piloto no baraja y el desajuste cliente↔servidor tiene OTRA causa.'
      : '  → Al menos una SÍ se baraja: entonces `option_order` DEBE llegar al guardado. Si en test_questions sale NULL, el orden se pierde por el camino y el servidor está corrigiendo contra la clave equivocada.',
  )
  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
