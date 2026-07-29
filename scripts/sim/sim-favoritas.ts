// scripts/sim/sim-favoritas.ts
//
// SIMULACIÓN de las preguntas favoritas (T-261) contra la BD REAL.
// Los tests unitarios mockean la BD; esto ejerce el SQL de verdad: marcar, contar,
// idempotencia del doble clic, hidratación de la pregunta para el test y borrado.
//
// Usa un usuario de prueba efímero que crea y borra él mismo — nunca datos de un
// cliente. Es seguro correrlo contra producción (crea y limpia lo suyo).
//
//   npx tsx --env-file=.env.local scripts/sim/sim-favoritas.ts
import postgres from 'postgres'
import {
  setFavorite,
  listFavoriteIds,
  getFavoriteQuestionsForUser,
} from '../../lib/api/question-favorites'

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: { rejectUnauthorized: false },
  max: 2,
})

const EMAIL = 'sim-favoritas@vence.es'
let fallos = 0

function comprobar(nombre: string, ok: boolean, detalle = '') {
  console.log(`${ok ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos++
}

async function main() {
  // Usuario efímero
  const [u] = await sql`
    INSERT INTO user_profiles (id, email, full_name, plan_type)
    VALUES (gen_random_uuid(), ${EMAIL}, 'Sim Favoritas', 'free')
    ON CONFLICT (email) DO UPDATE SET full_name = 'Sim Favoritas'
    RETURNING id`
  const userId = u.id as string

  // Dos preguntas activas reales con artículo y ley (lo que exige la hidratación)
  const preguntas = await sql`
    SELECT q.id FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE q.is_active = true LIMIT 2`
  if (preguntas.length < 2) throw new Error('no hay preguntas activas para simular')
  const [q1, q2] = preguntas.map((p) => p.id as string)

  try {
    // 1. Marcar
    const r1 = await setFavorite(userId, q1, true)
    comprobar('marcar devuelve isFavorite=true y total=1', r1.isFavorite && r1.total === 1, `total=${r1.total}`)

    // 2. Idempotencia: marcar dos veces NO duplica (el índice único hace el trabajo)
    const r2 = await setFavorite(userId, q1, true)
    comprobar('marcar dos veces sigue en total=1 (idempotente)', r2.total === 1, `total=${r2.total}`)

    // 3. Segunda pregunta
    const r3 = await setFavorite(userId, q2, true)
    comprobar('segunda pregunta → total=2', r3.total === 2, `total=${r3.total}`)

    // 4. Listado
    const ids = await listFavoriteIds(userId)
    comprobar('el listado trae las dos', ids.length === 2 && ids.includes(q1) && ids.includes(q2))

    // 5. Hidratación para el test (el join real questions×articles×laws)
    const test = await getFavoriteQuestionsForUser({ userId, numQuestions: 10 })
    const primera = test.questions[0]
    comprobar('sirve preguntas hidratadas', test.success && test.questionCount === 2, `n=${test.questionCount}`)
    comprobar(
      'cada pregunta trae enunciado, opciones y clave',
      !!primera && primera.question.length > 0 && primera.options.length >= 3 && primera.correct_option >= 0,
      primera ? `${primera.options.length} opciones` : 'sin preguntas',
    )

    // 6. Desmarcar
    const r4 = await setFavorite(userId, q1, false)
    comprobar('desmarcar baja el total', !r4.isFavorite && r4.total === 1, `total=${r4.total}`)

    // 7. Usuario sin favoritas → vacío explicativo, no error
    const [otro] = await sql`
      INSERT INTO user_profiles (id, email, full_name, plan_type)
      VALUES (gen_random_uuid(), 'sim-favoritas-vacio@vence.es', 'Sim Vacio', 'free')
      ON CONFLICT (email) DO UPDATE SET full_name = 'Sim Vacio' RETURNING id`
    const vacio = await getFavoriteQuestionsForUser({ userId: otro.id as string })
    comprobar('sin favoritas → success con lista vacía (no error)', vacio.success && vacio.questionCount === 0)
    await sql`DELETE FROM user_profiles WHERE id = ${otro.id}`

    // 8. CASCADE: al borrar la cuenta se van sus marcas (RGPD)
    await sql`DELETE FROM user_profiles WHERE id = ${userId}`
    const [{ n }] = await sql`
      SELECT count(*)::int AS n FROM user_question_favorites WHERE user_id = ${userId}`
    comprobar('borrar la cuenta arrastra sus favoritas (ON DELETE CASCADE)', Number(n) === 0, `quedan=${n}`)
  } finally {
    await sql`DELETE FROM user_profiles WHERE email IN (${EMAIL}, 'sim-favoritas-vacio@vence.es')`
    await sql.end()
  }

  console.log(fallos === 0 ? '\n✅ simulación OK' : `\n❌ ${fallos} comprobación(es) fallida(s)`)
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
