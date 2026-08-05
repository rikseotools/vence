#!/usr/bin/env node
/**
 * ¿Hay algún camino de respuesta que NO cobre cupo? (T-450)
 *
 * Uso:  npm run canary:cupo-vs-respuestas [-- --dias N]
 *
 * ## Por qué existe, y por qué NO es otro guardarraíl de código
 *
 * El cupo diario ya tiene un guardarraíl (`__tests__/guardrails/dailyQuotaServerSide.test.ts`)
 * que comprueba que los caminos de respuesta cobran. **Y aun así esto pasó**: cuando el 29/07 se
 * movió el cobro del cliente al servidor, ese guardarraíl enumeró los caminos que cobran… y se
 * dejó fuera el modo EXAMEN, que no pasa por `answer-and-save`. Un guardarraíl que enumera solo
 * protege lo que enumeró, y el que se olvida es justo el que se rompe.
 *
 * Esto mira los DATOS, así que no depende de ninguna lista: si mañana aparece un quinto camino de
 * respuesta y nadie se acuerda de cobrarlo, aquí se ve igual.
 *
 * ## El criterio, y por qué no da falsos positivos
 *
 * `daily_question_usage.questions_answered` es CUPO CONSUMIDO y **satura en el tope**: un free que
 * responde 25 tiene el contador en 25, y uno que responde 200 también. Así que comparar respuestas
 * contra contador a secas marcaría a todo el mundo.
 *
 * La firma de la fuga es otra: **respondió MÁS que el tope y el contador se quedó POR DEBAJO**. Si
 * todos los caminos cobrasen, cualquiera que llega al tope tendría el contador AL tope. Que no lo
 * esté significa que algo de lo que respondió no pasó por caja.
 *
 * Se deja un margen (`HOLGURA`) porque el cobro es fail-silent a propósito: si el contador falla,
 * el usuario se lleva la pregunta gratis — mejor eso que un bloqueo indebido. Ese goteo es normal.
 */
const path = require('path')
// Sin esto, `npm run canary:cupo-vs-respuestas` —el comando que documenta la ficha— muere con
// «no hay URL de base de datos» y el canario no habla nunca. Lo hacen todos sus hermanos
// (`canary-familia`, `canary-oposiciones-live`, `canary-isr-purge`…); este nació sin ello y
// se estrenó ejecutándolo a mano con `--env-file`, así que el hueco no se vio.
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { Client } = require('pg')
const { pgConfig } = require(path.join(__dirname, '..', 'lib', 'db', 'pgSsl.cjs'))

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const DIAS = Number(arg('--dias', 7))
const HOLGURA = 5          // respuestas de más que se toleran por el fail-silent del cobro
const TECHO = Number(arg('--techo', 3))   // usuarios-día con fuga que se consideran ruido

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()
  const { rows } = await c.query(`
    WITH resp AS (
      SELECT tq.user_id, tq.created_at::date AS d, count(*) AS respuestas
        FROM test_questions tq
        JOIN user_profiles up ON up.id = tq.user_id
       WHERE up.plan_type = 'free'
         AND tq.user_answer IS NOT NULL AND tq.user_answer <> ''
         AND tq.created_at > now() - ($1 || ' days')::interval
         -- El plan hay que juzgarlo en la FECHA de la respuesta, no hoy. Un usuario que
         -- entonces era premium no consumía cupo POR DISEÑO, y hoy puede ser free porque su
         -- suscripción venció: contarlo sería inventarse una fuga. Falso positivo REAL y
         -- medido — 11 de los 20 marcados en julio tenían suscripción en esas fechas.
         AND NOT EXISTS (
           SELECT 1 FROM user_subscriptions us
            WHERE us.user_id = tq.user_id
              -- SIN filtrar por status, y esto costó cometer DOS VECES el mismo error:
              -- status es el de HOY. Una suscripción que estuvo activa en julio y se canceló
              -- en agosto figura hoy como cancelada, así que exigir estado activo vuelve a
              -- juzgar el pasado con el presente, que es justo lo que esta guarda venía a
              -- arreglar. Lo que decide es si el PERIODO cubre el día de la respuesta.
              -- Caso que lo destapó: un usuario con premium mensual del 25/06 al 25/07 y
              -- 300 respuestas diarias sin cobrar, que es lo correcto: era premium.
              AND tq.created_at::date BETWEEN us.current_period_start::date
                                          AND COALESCE(us.current_period_end::date, CURRENT_DATE))
         -- ── EL TEST RECUPERADO NO ES UNA FUGA (05/08/2026) ───────────────────────────────
         -- Quien prueba la app SIN cuenta y luego se registra recibe su test anónimo adjuntado
         -- a la cuenta nueva. Esas respuestas se persisten TODAS de golpe, ya contestadas, y
         -- nunca gastaron cupo — correctamente: cuando las dio no había cuenta a la que
         -- cobrárselas. El canario las veía como «respondió 50 con el contador a 0».
         -- Caso que lo destapó: cuenta creada a las 17:18:03 y test de 50 adjuntado 7 s después.
         --
         -- ⚠️ HACEN FALTA LAS DOS CONDICIONES, y la primera versión de esta guarda llevaba solo
         -- una. La firma del VOLCADO (todas las respuestas insertadas en el mismo instante que
         -- el test) NO basta: el modo EXAMEN persiste en lote por diseño, así que la tienen
         -- **63 de 1.794 tests de examen (3,5 %)** — y cegar al canario ahí sería cegarlo justo
         -- en el camino para el que nació esta ficha. Se comprobó antes de subirlo: con solo esa
         -- condición se excluía un test del usuario 9f9d60c1, que es un caso de fuga REAL.
         --
         -- Lo que define al test recuperado es que se adjunta AL CREAR LA CUENTA. Por eso se
         -- exige además que el test naciera pegado al alta. El tiempo por sí solo tampoco vale
         -- (la distribución es continua: 552 tests en los primeros 50 s y una cola larga), pero
         -- JUNTO al volcado sí: un test importado en bloque en los dos primeros minutos de vida
         -- de la cuenta es el test anónimo, no una sesión de estudio.
         AND NOT EXISTS (
           SELECT 1 FROM tests t
            WHERE t.id = tq.test_id
              AND t.created_at <= up.created_at + interval '2 minutes'
              AND (SELECT count(*) FROM test_questions x
                    WHERE x.test_id = t.id AND x.user_answer IS NOT NULL AND x.user_answer <> '') >= 10
              AND (SELECT max(x.created_at) FROM test_questions x WHERE x.test_id = t.id)
                  <= t.created_at + interval '5 seconds')
       GROUP BY 1, 2)
    SELECT r.d AS dia, count(*) AS usuarios_con_fuga,
           sum(r.respuestas - COALESCE(u.questions_answered, 0)) AS respuestas_sin_cobrar
      FROM resp r
      LEFT JOIN daily_question_usage u ON u.user_id = r.user_id AND u.usage_date = r.d
     WHERE r.respuestas > 25 + $2                      -- llegó de sobra al tope…
       AND COALESCE(u.questions_answered, 0) < 25      -- …y el contador NO llegó
     GROUP BY 1 ORDER BY 1 DESC`, [String(DIAS), HOLGURA])

  console.log(`\n🕯️  Cupo vs respuestas reales — usuarios FREE, ${DIAS} días`)
  console.log('   (fuga = respondió por encima del tope y su contador se quedó por debajo)\n')
  if (!rows.length) {
    console.log('   ningún usuario-día con fuga.')
  } else {
    for (const r of rows) {
      console.log(`   ${String(r.dia).slice(0, 10)}  ·  ${r.usuarios_con_fuga} usuario(s)  ·  ${r.respuestas_sin_cobrar} respuestas sin cobrar`)
    }
  }
  await c.end()

  const peor = rows.reduce((m, r) => Math.max(m, Number(r.usuarios_con_fuga)), 0)
  console.log(`\n   peor día: ${peor} usuario(s) · techo ${TECHO}`)
  if (peor > TECHO) {
    console.error('\n❌ HAY UN CAMINO DE RESPUESTA QUE NO COBRA CUPO.')
    console.error('   Busca por qué tipo de test entran esas respuestas:')
    console.error("     SELECT t.test_type, count(*) FROM test_questions tq JOIN tests t ON t.id=tq.test_id")
    console.error("      WHERE tq.user_id='<uuid>' AND tq.created_at::date='<dia>' GROUP BY 1;")
    console.error('   Ficha: [T-450] · guardarraíl de código: __tests__/guardrails/dailyQuotaServerSide.test.ts')
    process.exit(2)
  }
  console.log('\n✅ dentro del techo.')
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
