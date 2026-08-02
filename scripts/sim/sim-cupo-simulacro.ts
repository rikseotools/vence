#!/usr/bin/env npx tsx
/**
 * ¿Cobra cupo el SIMULACRO cuando alguien responde? (T-450)
 *
 * Los guardarraíles de `dailyQuotaServerSide` leen el fuente y comprueban que se llama a
 * quien hay que llamar. Eso caza un borrado, **no un comportamiento**. Esta simulación
 * EJECUTA el camino real —`saveOfficialExamAnswer` + la misma decisión que toma el route—
 * contra la BD de verdad, con usuarios efímeros que se limpian solos, y mira el contador.
 *
 * Comprueba las cuatro cosas que decidieron el diseño, y las cuatro han fallado alguna vez
 * en este proyecto:
 *   1. responder por primera vez en una fila PRE-CREADA cobra 1 (el hueco de T-450);
 *   2. rectificar esa misma respuesta NO cobra otra vez (el incidente de T-260 al revés);
 *   3. un plan exento (`trial`, no solo `premium`) no consume nunca (la sexta definición
 *      de «premium» que se coló el 02/08);
 *   4. el contador que se mueve es el del DÍA en Europe/Madrid, que es el que ve el gate.
 *
 * Solo escribe en filas efímeras suyas y las borra al terminar (también si falla).
 *
 * Uso:  npm run sim:cupo-simulacro
 */
import postgres from 'postgres'
import { saveOfficialExamAnswer } from '../../lib/api/official-exams/queries'
import { debeConsumirCupo, incrementDailyCount } from '../../lib/api/dailyLimit'

const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false }, max: 2 })

const fallos: string[] = []
function comprobar(nombre: string, ok: boolean, detalle: string) {
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos.push(nombre)
}

/** Contador del día (Europe/Madrid), que es el que mira el gate. */
async function contador(userId: string): Promise<number> {
  const r = await sql<{ n: number }[]>`
    SELECT COALESCE(questions_answered, 0)::int AS n FROM daily_question_usage
     WHERE user_id = ${userId}::uuid
       AND usage_date = (NOW() AT TIME ZONE 'Europe/Madrid')::date`
  return r[0]?.n ?? 0
}

/** Lo que hace el route tras guardar: misma política, mismo incremento. */
async function cobrarComoElRoute(res: {
  saveAction?: string
  userId?: string | null
  isPremium?: boolean
}) {
  if (res.userId && debeConsumirCupo(res.saveAction, res.isPremium === true)) {
    await incrementDailyCount(res.userId)
  }
}

async function montarEscenario(planType: string) {
  const [u] = await sql<{ id: string }[]>`
    INSERT INTO user_profiles (id, email, full_name, plan_type)
    VALUES (gen_random_uuid(), 'sim-cupo-' || gen_random_uuid() || '@vence.test', 'Sim Cupo', ${planType})
    RETURNING id`
  const [t] = await sql<{ id: string }[]>`
    INSERT INTO tests (id, user_id, title, test_type, total_questions, is_completed)
    VALUES (gen_random_uuid(), ${u.id}::uuid, 'Simulacro (simulación T-450)', 'exam', 1, false)
    RETURNING id`
  // La fila PRE-CREADA, con la respuesta en blanco (`''`, porque la columna es NOT NULL — de ahí
  // que la regla compartida mire cadena vacía y no solo null): es la forma exacta en que el simulacro
  // deja las preguntas al abrirse, y la que confundía «existe» con «ya respondió».
  await sql`
    INSERT INTO test_questions (id, test_id, user_id, question_order, question_text, correct_answer, user_answer, is_correct)
    VALUES (gen_random_uuid(), ${t.id}::uuid, ${u.id}::uuid, 1, 'Pregunta de simulación', 'a', '', false)`
  return { userId: u.id, testId: t.id }
}

/**
 * Borra el rastro del usuario efímero. Las tablas se descubren solas por sus claves
 * ajenas a `user_profiles`: guardar una respuesta dispara triggers (rachas, métricas) que
 * crean filas en tablas que esta simulación no conoce, y una lista escrita a mano se
 * quedaría corta en cuanto alguien añada un trigger nuevo.
 */
async function limpiar(userId: string) {
  const dependientes = await sql<{ tabla: string; columna: string }[]>`
    SELECT c.relname AS tabla, a.attname AS columna
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_class f ON f.oid = con.confrelid
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND f.relname = 'user_profiles'
       AND c.relnamespace = 'public'::regnamespace`
  for (const d of dependientes) {
    await sql`DELETE FROM ${sql(d.tabla)} WHERE ${sql(d.columna)} = ${userId}::uuid`.catch(() => {})
  }
  await sql`DELETE FROM user_profiles WHERE id = ${userId}::uuid`
  const [q] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM user_profiles WHERE id = ${userId}::uuid`
  if (q.n !== 0) console.log(`   ⚠️ el usuario efímero ${userId.slice(0, 8)} NO se pudo borrar — revísalo a mano`)
}

async function main() {
  console.log('🎫 SIMULACIÓN — el simulacro cobra cupo al responder (T-450)\n')

  // ---- Caso free: estrena y rectifica -------------------------------------------------
  const free = await montarEscenario('free')
  try {
    console.log('1) Usuario FREE con una fila pre-creada en blanco')
    const antes = await contador(free.userId)

    const r1 = await saveOfficialExamAnswer({ testId: free.testId, questionOrder: 1, userAnswer: 'a' })
    await cobrarComoElRoute(r1)
    const tras1 = await contador(free.userId)
    comprobar('responder por primera vez estrena', r1.saveAction === 'saved_new', `saveAction=${r1.saveAction}`)
    comprobar('el contador sube exactamente 1', tras1 === antes + 1, `${antes} → ${tras1}`)

    const r2 = await saveOfficialExamAnswer({ testId: free.testId, questionOrder: 1, userAnswer: 'b' })
    await cobrarComoElRoute(r2)
    const tras2 = await contador(free.userId)
    comprobar('rectificar NO estrena', r2.saveAction === 'already_saved', `saveAction=${r2.saveAction}`)
    comprobar('el contador NO vuelve a subir', tras2 === tras1, `${tras1} → ${tras2}`)

    // Y que la respuesta se guardó de verdad: cobrar sin guardar sería el peor de los mundos.
    const [g] = await sql<{ user_answer: string }[]>`
      SELECT user_answer FROM test_questions WHERE test_id = ${free.testId}::uuid AND question_order = 1`
    comprobar('la respuesta rectificada quedó guardada', g.user_answer === 'b', `user_answer=${g.user_answer}`)
  } finally {
    await limpiar(free.userId)
  }

  // ---- Caso plan exento que NO se llama «premium» -------------------------------------
  console.log('\n2) Usuario TRIAL (plan exento que no se llama «premium»)')
  const trial = await montarEscenario('trial')
  try {
    const antes = await contador(trial.userId)
    const r = await saveOfficialExamAnswer({ testId: trial.testId, questionOrder: 1, userAnswer: 'a' })
    await cobrarComoElRoute(r)
    const despues = await contador(trial.userId)
    comprobar('se reconoce como exento', r.isPremium === true, `isPremium=${r.isPremium}`)
    comprobar('no consume cupo', despues === antes, `${antes} → ${despues}`)
  } finally {
    await limpiar(trial.userId)
  }

  console.log('\n🧹 limpieza: usuarios efímeros y sus filas borrados')
  console.log(
    fallos.length === 0
      ? '\n✅ SIMULACIÓN VERDE — el simulacro cobra al estrenar, no al rectificar, y respeta los planes exentos.'
      : `\n❌ FALLA: ${fallos.join(' · ')}`,
  )
  await sql.end()
  process.exit(fallos.length === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('💥 ERROR:', e)
  await sql.end().catch(() => {})
  process.exit(2)
})
