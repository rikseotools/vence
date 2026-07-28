#!/usr/bin/env npx tsx
/**
 * SIMULACIÓN del panel "Tu Evolución en esta pregunta" con los DATOS REALES de un usuario.
 *
 * Para qué: MariSol (feedback 108cc2a8, 28/07/2026) reportó que las bolitas verde/roja del
 * historial "salen al revés de vez en cuando". Adjuntó tres capturas. En vez de razonar sobre
 * píxeles, esto replayea sus intentos REALES (los que devuelve /api/v2/question-evolution/history,
 * ORDER BY created_at ASC, sin límite) por la MISMA función pura que pinta el panel
 * (`calcularEvolucionCompleta`), y compara el resultado con lo que ella vio.
 *
 * Qué decidió (28/07): las bolitas y el porcentaje coincidían EXACTAMENTE con `test_questions` en
 * los tres casos, y la función pura devolvía el mensaje correcto cuando se le daba la entrada
 * correcta → el fallo estaba en la ENTRADA (`currentResult`, derivado del estado del cliente),
 * porque la cabecera bebía de él mientras las bolitas bebían de la fila guardada. Dos fuentes para
 * el mismo hecho.
 *
 * Qué comprueba AHORA (regresión): se le inyecta a propósito un resultado de cliente INVERTIDO y
 * se exige que la cabecera siga respetando lo que dice la BD. Si alguien vuelve a separar las dos
 * fuentes, esto se pone rojo. El juicio lo pone el mismo invariante que el journey de navegador.
 *
 * Uso:  npx tsx scripts/sim/sim-evolucion-marisol.ts <email> [questionIdPrefix...]
 */
import postgres from 'postgres'
import { calcularEvolucionCompleta, clasificarIntento } from '../../components/QuestionEvolution'
import { evolutionHeaderMatchesLastAttempt } from '../../lib/sim/invariants'

const EMAIL = process.argv[2] || 'flor7687@gmail.com'
const PREFIJOS = process.argv.slice(3).length ? process.argv.slice(3) : ['3bdd3565', '4ed7bbcc', '89021fe8']

// Lo que la usuaria vio en cada captura (transcrito de las imágenes que adjuntó).
const OBSERVADO: Record<string, { mensaje: string; porcentaje: number; intentos: number }> = {
  '3bdd3565': { mensaje: '¡Progreso! Antes fallaste, ahora acertaste', porcentaje: 17, intentos: 6 },
  '4ed7bbcc': { mensaje: 'Sigues fallando esta pregunta (0/2)', porcentaje: 50, intentos: 2 },
  '89021fe8': { mensaje: 'Siempre aciertas esta pregunta (3/3)', porcentaje: 67, intentos: 3 },
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL as string, { ssl: { rejectUnauthorized: false }, max: 1 })
  const [u] = await sql`SELECT id FROM user_profiles WHERE email = ${EMAIL}`
  if (!u) throw new Error(`sin usuario ${EMAIL}`)

  let fallos = 0
  for (const pref of PREFIJOS) {
    // Mismo orden y mismas columnas que el endpoint real.
    const rows = await sql`
      SELECT id, user_answer, correct_answer, is_correct, was_blank, confidence_level,
             time_spent_seconds, created_at, test_id, question_order
        FROM test_questions
       WHERE user_id = ${u.id} AND question_id::text LIKE ${pref + '%'}
       ORDER BY created_at ASC`

    // El intento "actual" es el de la sesión en curso: en las capturas, el ÚLTIMO de ese momento.
    // Se reconstruye el estado tal cual estaba cuando ella miró (la captura es de las 16:2x/16:32,
    // así que se corta el historial en el intento de ese momento — un intento posterior del mismo
    // día no existía todavía en pantalla).
    const idxActual = rows.findIndex((r: any) => new Date(r.created_at) > new Date('2026-07-28T14:20:00Z'))
    const hasta = idxActual >= 0 ? idxActual + 1 : rows.length
    // El endpoint serializa `created_at` con to_char → STRING ISO. El driver lo entrega como Date;
    // si no se convierte, la simulación no reproduce el contrato real (y revienta en el parseo).
    const history = rows.slice(0, hasta).map((r: any) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    })) as any[]
    const actual = history[history.length - 1]

    // `currentResult` tal como DEBERÍA ser: el resultado REAL del intento que acaba de hacer.
    const currentResult = {
      is_correct: actual.is_correct,
      was_blank: actual.was_blank ?? false,
      time_spent_seconds: actual.time_spent_seconds ?? 0,
      confidence_level: actual.confidence_level ?? null,
      test_id: actual.test_id,
    }

    // Se le pasa el resultado del cliente EQUIVOCADO a propósito (invertido respecto a la BD):
    // así se comprueba que el panel ya no se deja arrastrar por él y manda la fila persistida.
    const evo = calcularEvolucionCompleta(history, { ...currentResult, is_correct: !actual.is_correct } as any)
    const dots = history.map((h) => (clasificarIntento(h) === 'correct' ? '✓' : clasificarIntento(h) === 'blank' ? '·' : '✗')).join('')
    const obs = OBSERVADO[pref]

    // El juicio lo pone el MISMO invariante que usa el journey de navegador (lib/sim/invariants),
    // para que la simulación de datos y la de navegador no puedan divergir en el criterio.
    const veredicto = evolutionHeaderMatchesLastAttempt({
      headerText: evo.mensaje,
      lastAttemptCorrect: actual.is_correct === true,
    })

    console.log(`\n── pregunta ${pref} ──`)
    console.log(`  intentos reales      : ${history.length}  ${dots}  (último: ${actual.is_correct ? 'ACIERTO' : 'FALLO'}, respondió "${actual.user_answer}")`)
    console.log(`  cabecera ahora       : "${evo.mensaje}"`)
    console.log(`  aciertos             : ${evo.tasaAciertos}% (${evo.totalIntentos} intentos)`)
    if (obs) console.log(`  (lo que ella vio     : "${obs.mensaje}")`)
    console.log(`  discrepancia cliente↔servidor detectada: ${evo.discrepanciaClienteServidor ? 'SÍ (se emite evento)' : 'no'}`)
    console.log(`  ▶ ${veredicto.ok ? '✅ la cabecera respeta lo que respondió' : '❌ ' + veredicto.detail}`)
    if (!veredicto.ok) fallos++
  }

  console.log(
    `\n▶ VEREDICTO: ${fallos === 0
      ? '✅ la cabecera NO contradice a la BD en ningún caso, ni siquiera alimentándola con un resultado de cliente equivocado'
      : `❌ ${fallos} caso(s) en los que la cabecera sigue contradiciendo lo que el usuario respondió`}`,
  )
  await sql.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
