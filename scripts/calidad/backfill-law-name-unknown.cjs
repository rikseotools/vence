#!/usr/bin/env node
// scripts/calidad/backfill-law-name-unknown.cjs
//
// Repara `test_questions.law_name` allí donde se persistió un RELLENO en vez de la ley
// (T-559). Resuelve la ley de verdad desde `article_id` → `articles` → `laws`.
//
// POR QUÉ: el gemelo del backend guardaba el literal 'unknown' cuando el cliente no mandaba
// la ley. Aguas abajo eso NO se comporta como un hueco sino como una ley más: el agregador de
// artículos problemáticos agrupa por `law_name`, así que fundía artículos de Excel 365,
// Word 365 y Access 365 en una tarjeta titulada «Artículos Problemáticos: unknown», con un
// botón de teoría hacia /teoria/unknown (404) y un test intensivo que servía otra materia.
// Medido el 05/08/2026: 15.109 filas, 253 usuarios, 15.057 (99,7%) resolubles desde su artículo.
//
// ⚠️ NO INVENTA NADA. Solo escribe la ley que dice `articles`→`laws` para el `article_id` que
// la propia fila ya tiene. Lo que no se puede resolver se deja en `NULL` (honesto) y se
// CUENTA en el informe — no se rellena con otra cosa, que es justo el defecto que repara.
//
//   node scripts/calidad/backfill-law-name-unknown.cjs              # simula (por defecto)
//   node scripts/calidad/backfill-law-name-unknown.cjs --apply      # escribe
//   node scripts/calidad/backfill-law-name-unknown.cjs --apply --lote 2000
//
// Idempotente: repetirlo no cambia nada una vez limpio (el WHERE solo ve rellenos).

require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

// El criterio de "esto no es una ley" vive en `lib/laws/lawNameResuelta.ts` y es el mismo que
// usan el escritor, el escudo de la notificación y el canario. Aquí se replica la LISTA en SQL
// porque el filtro tiene que correr dentro de la consulta (traerse 15k filas a JS para
// descartarlas sería absurdo); `__tests__/guardrails/lawNameResueltaParidad.test.ts` vigila que
// no diverja.
const RELLENOS = ['unknown', 'undefined', 'null', 'nan']

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const LOTE = Number(args[args.indexOf('--lote') + 1]) || 1000

/** Tope de seguridad: si hay que tocar más filas que esto, algo ha cambiado — parar y mirar. */
const ABORTAR_SI_MAS_DE = 60_000

async function main() {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  console.log(`\n🔧 Backfill de law_name (T-559) — ${APPLY ? 'APLICANDO' : 'SIMULACIÓN (usa --apply para escribir)'}\n`)

  // 1. Foto de partida, separando lo reparable de lo que no.
  const { rows: [foto] } = await c.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT user_id)::int AS usuarios,
            COUNT(*) FILTER (WHERE article_id IS NOT NULL)::int AS con_articulo
       FROM test_questions
      WHERE lower(btrim(law_name)) = ANY($1::text[])`,
    [RELLENOS],
  )

  if (foto.total === 0) {
    console.log('✅ Nada que reparar: no queda ninguna fila con un relleno por ley.')
    await c.end()
    return
  }

  console.log(`   filas con relleno : ${foto.total}`)
  console.log(`   usuarios afectados: ${foto.usuarios}`)
  console.log(`   con article_id    : ${foto.con_articulo}`)

  if (foto.total > ABORTAR_SI_MAS_DE) {
    // Un backfill masivo inesperado no es un trámite: es señal de que el escritor volvió
    // a rellenar a lo grande. Se para y se mira antes de tocar 60.000 filas.
    console.error(`\n❌ ABORTADO: ${foto.total} filas supera el tope de ${ABORTAR_SI_MAS_DE}.`)
    console.error('   Comprueba si algún escritor volvió a persistir el relleno antes de seguir.')
    await c.end()
    process.exitCode = 1
    return
  }

  // 2. Qué leyes saldrían — es lo que hace revisable la simulación.
  const { rows: previo } = await c.query(
    `SELECT l.short_name, COUNT(*)::int AS n
       FROM test_questions tq
       JOIN articles a ON a.id = tq.article_id
       JOIN laws     l ON l.id = a.law_id
      WHERE lower(btrim(tq.law_name)) = ANY($1::text[])
      GROUP BY l.short_name
      ORDER BY n DESC
      LIMIT 15`,
    [RELLENOS],
  )
  console.log('\n   leyes que se repondrían (top 15):')
  for (const r of previo) console.log(`     ${String(r.n).padStart(6)}  ${r.short_name}`)

  // El total se cuenta APARTE. Sumar el top-15 daría una cifra menor y creíble, que es la
  // peor clase de error en un informe: nadie la comprueba porque parece razonable.
  const { rows: [tot] } = await c.query(
    `SELECT COUNT(*)::int AS reparables
       FROM test_questions tq
       JOIN articles a ON a.id = tq.article_id
       JOIN laws     l ON l.id = a.law_id
      WHERE lower(btrim(tq.law_name)) = ANY($1::text[])`,
    [RELLENOS],
  )
  const reparables = tot.reparables
  const irreparables = foto.total - reparables
  console.log(`   (leyes distintas implicadas: ${previo.length >= 15 ? '15+' : previo.length})`)
  console.log(`\n   → reparables: ${reparables}`)
  console.log(`   → NO reparables (se quedan en NULL, honesto): ${irreparables}`)

  // Foto de la tabla derivada — hay que enseñarla en la simulación, porque es donde el
  // daño es MAYOR (parte las estadísticas del usuario) y donde la reparación no es trivial.
  const { rows: [der] } = await c.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT user_id)::int AS usuarios,
            COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM user_article_stats v
                JOIN articles a ON a.id = u.article_id
                JOIN laws     l ON l.id = a.law_id
               WHERE v.user_id = u.user_id AND v.article_id = u.article_id
                 AND v.article_number = u.article_number
                 AND v.tema_number IS NOT DISTINCT FROM u.tema_number
                 AND v.law_name = l.short_name))::int AS a_fundir
       FROM user_article_stats u
      WHERE lower(btrim(u.law_name)) = ANY($1::text[])`,
    [RELLENOS],
  )
  console.log('\n   ── user_article_stats (estadísticas por artículo) ──')
  console.log(`     filas con relleno : ${der.total}`)
  console.log(`     usuarios afectados: ${der.usuarios}`)
  console.log(`     a FUNDIR (ya tienen hermana con la ley buena): ${der.a_fundir}`)
  console.log(`     a renombrar       : ${der.total - der.a_fundir}`)

  if (!APPLY) {
    console.log('\n🔎 Simulación: no se ha escrito nada. Repite con --apply.\n')
    await c.end()
    return
  }

  // 3. Escritura por lotes. Dos pasadas distintas y en este orden:
  //    (a) las que SÍ resuelven → se les pone su ley,
  //    (b) las que no → a NULL, porque dejar el relleno es seguir mintiendo.
  let repuestas = 0
  for (;;) {
    const { rowCount } = await c.query(
      `UPDATE test_questions tq
          SET law_name = l.short_name
         FROM articles a, laws l
        WHERE tq.id IN (
                SELECT id FROM test_questions
                 WHERE lower(btrim(law_name)) = ANY($1::text[])
                   AND article_id IS NOT NULL
                 LIMIT $2
              )
          AND a.id = tq.article_id
          AND l.id = a.law_id`,
      [RELLENOS, LOTE],
    )
    if (rowCount === 0) break
    repuestas += rowCount
    process.stdout.write(`\r   repuestas: ${repuestas}`)
  }
  console.log(`\r   repuestas: ${repuestas}   `)

  const { rowCount: aNull } = await c.query(
    `UPDATE test_questions
        SET law_name = NULL
      WHERE lower(btrim(law_name)) = ANY($1::text[])`,
    [RELLENOS],
  )
  console.log(`   pasadas a NULL (no resolubles): ${aNull}`)

  // 4. La tabla DERIVADA. `user_article_stats` recibe `law_name` desde el outbox de
  //    `test_questions`, y lo lleva DENTRO de su índice único
  //    (user_id, article_id, article_number, law_name, tema_number).
  //
  //    Consecuencia que no se ve mirando solo el origen: el relleno no "ensuciaba una
  //    columna", PARTÍA las estadísticas por artículo en dos filas — una bajo la ley real y
  //    otra bajo 'unknown'— y las superficies que las leen (theme-stats,
  //    oposiciones-compatibles/progress) enseñaban los contadores divididos. Medido el
  //    05/08: 15.810 filas y 492 usuarios, MÁS usuarios que en el origen, porque aquí
  //    quedó también lo de antes del backfill de junio.
  //
  //    Por eso aquí NO vale un UPDATE: 9.049 de esas filas ya tienen hermana con la ley
  //    buena y el índice único las rechazaría. Hay que FUNDIR (sumar contadores y borrar la
  //    fila-relleno) y solo actualizar las que no tienen con quién fundirse.
  //
  //    `user_article_stats_pre_outbox` se deja fuera a propósito: es la foto congelada de
  //    antes del cutover y no la lee nadie (solo se nombra en el comentario del rename).
  await repararDerivada(c)

  // 5. Verificar el invariante DESPUÉS de escribir. Declararlo no es comprobarlo.
  const { rows: [despues] } = await c.query(
    `SELECT COUNT(*)::int AS quedan
       FROM test_questions
      WHERE lower(btrim(law_name)) = ANY($1::text[])`,
    [RELLENOS],
  )
  const { rows: [despuesDer] } = await c.query(
    `SELECT COUNT(*)::int AS quedan
       FROM user_article_stats
      WHERE lower(btrim(law_name)) = ANY($1::text[])`,
    [RELLENOS],
  )
  console.log(`\n   quedan con relleno — test_questions: ${despues.quedan}`)
  console.log(`   quedan con relleno — user_article_stats: ${despuesDer.quedan}`)
  if (despues.quedan > 0 || despuesDer.quedan > 0) {
    console.error('❌ El invariante NO se cumple: siguen quedando rellenos.')
    process.exitCode = 1
  } else {
    console.log('✅ Invariante cumplido: ninguna fila conserva un relleno por ley.\n')
  }

  await c.end()
}

/**
 * Repara `user_article_stats`, donde `law_name` forma parte del índice único y por tanto el
 * relleno no ensucia una columna: PARTE en dos las estadísticas por artículo del usuario.
 *
 * Dos pasadas, en este orden y dentro de una transacción:
 *   (a) FUNDIR   — la fila-relleno que ya tiene hermana con la ley correcta: se suman sus
 *                  contadores a la hermana y se borra. Un UPDATE aquí violaría el índice.
 *   (b) RENOMBRAR— la que no tiene hermana: basta con ponerle su ley de verdad.
 * Lo que no resuelve su artículo se deja como está y se CUENTA (no se inventa).
 */
async function repararDerivada(c) {
  console.log('\n   ── user_article_stats (estadísticas por artículo) ──')

  await c.query('BEGIN')
  try {
    // (a) Fundir las que colisionarían.
    const { rows: fundidas } = await c.query(
      `WITH relleno AS (
         SELECT u.id, u.user_id, u.article_id, u.article_number, u.tema_number,
                l.short_name AS ley_real, u.total_questions, u.correct_answers
           FROM user_article_stats u
           JOIN articles a ON a.id = u.article_id
           JOIN laws     l ON l.id = a.law_id
          WHERE lower(btrim(u.law_name)) = ANY($1::text[])
       ),
       sumadas AS (
         UPDATE user_article_stats v
            SET total_questions = v.total_questions + r.total_questions,
                correct_answers = v.correct_answers + r.correct_answers,
                updated_at = NOW()
           FROM relleno r
          WHERE v.user_id         = r.user_id
            AND v.article_id      = r.article_id
            AND v.article_number  = r.article_number
            AND v.tema_number IS NOT DISTINCT FROM r.tema_number
            AND v.law_name        = r.ley_real
          RETURNING r.id
       )
       DELETE FROM user_article_stats WHERE id IN (SELECT id FROM sumadas) RETURNING id`,
      [RELLENOS],
    )
    console.log(`     fundidas con su hermana (contadores sumados): ${fundidas.length}`)

    // (b) Renombrar las que quedan y sí resuelven su ley.
    const { rowCount: renombradas } = await c.query(
      `UPDATE user_article_stats u
          SET law_name = l.short_name, updated_at = NOW()
         FROM articles a, laws l
        WHERE lower(btrim(u.law_name)) = ANY($1::text[])
          AND a.id = u.article_id
          AND l.id = a.law_id`,
      [RELLENOS],
    )
    console.log(`     renombradas a su ley real: ${renombradas}`)

    const { rows: [resto] } = await c.query(
      `SELECT COUNT(*)::int AS n FROM user_article_stats
        WHERE lower(btrim(law_name)) = ANY($1::text[])`,
      [RELLENOS],
    )
    if (resto.n > 0) {
      // Sin artículo que resolver: se pasan a NULL igual que en el origen. No se fusionan
      // porque el índice es NULLS NOT DISTINCT y una hermana con NULL ya sería la misma fila.
      const { rowCount: aNull } = await c.query(
        `UPDATE user_article_stats SET law_name = NULL, updated_at = NOW()
          WHERE lower(btrim(law_name)) = ANY($1::text[])
            AND NOT EXISTS (
              SELECT 1 FROM user_article_stats v
               WHERE v.user_id = user_article_stats.user_id
                 AND v.article_id IS NOT DISTINCT FROM user_article_stats.article_id
                 AND v.article_number = user_article_stats.article_number
                 AND v.tema_number IS NOT DISTINCT FROM user_article_stats.tema_number
                 AND v.law_name IS NULL)`,
        [RELLENOS],
      )
      console.log(`     sin artículo → NULL: ${aNull}`)
      const { rows: [irrecuperables] } = await c.query(
        `SELECT COUNT(*)::int AS n FROM user_article_stats
          WHERE lower(btrim(law_name)) = ANY($1::text[])`,
        [RELLENOS],
      )
      if (irrecuperables.n > 0) {
        // Colisionan con una hermana NULL: se funden igual que en (a).
        const { rows: f2 } = await c.query(
          `WITH relleno AS (
             SELECT id, user_id, article_id, article_number, tema_number,
                    total_questions, correct_answers
               FROM user_article_stats
              WHERE lower(btrim(law_name)) = ANY($1::text[])
           ),
           sumadas AS (
             UPDATE user_article_stats v
                SET total_questions = v.total_questions + r.total_questions,
                    correct_answers = v.correct_answers + r.correct_answers,
                    updated_at = NOW()
               FROM relleno r
              WHERE v.user_id        = r.user_id
                AND v.article_id IS NOT DISTINCT FROM r.article_id
                AND v.article_number = r.article_number
                AND v.tema_number IS NOT DISTINCT FROM r.tema_number
                AND v.law_name IS NULL
              RETURNING r.id
           )
           DELETE FROM user_article_stats WHERE id IN (SELECT id FROM sumadas) RETURNING id`,
          [RELLENOS],
        )
        console.log(`     fundidas con hermana NULL: ${f2.length}`)
      }
    }

    await c.query('COMMIT')
  } catch (err) {
    await c.query('ROLLBACK')
    throw err
  }
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exitCode = 1
})
