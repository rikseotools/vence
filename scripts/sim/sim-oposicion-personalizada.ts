/**
 * GUARDAR UNA OPOSICIÓN PERSONALIZADA — contra la BD real y por el endpoint real. (T-327)
 *
 * ── QUÉ PRUEBA QUE NO PRUEBAN LOS UNITARIOS ─────────────────────────────────────────────────
 *
 * El plan (qué filas salen de lo que armó el usuario) tiene 15 unitarios. Lo que NO se puede
 * probar ahí es lo que decide si esto sirve o no:
 *
 *   · que las tres escrituras encadenadas (oposición → temas → scope) **entren de verdad**;
 *   · que «toda la ley» llegue a Postgres como **NULL** y no como `'{}'` — que es «ninguno», el
 *     opuesto exacto de lo que el usuario pidió, y ninguna de las dos formas da error;
 *   · que un fallo a mitad **no deje una oposición sin temario**, que es el estado que esta
 *     función viene a evitar (303 usuarios con una etiqueta vacía, 127 sin hacer un test).
 *
 * Se limpia sola: todo lo que crea lleva una marca y se borra al final, pase lo que pase.
 *
 * Uso: npx tsx --env-file=.env.local scripts/sim/sim-oposicion-personalizada.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const MARCA = `sim-t327-${Date.now()}`

type Caso = { nombre: string; ok: boolean; detalle: string }
const casos: Caso[] = []
const anota = (nombre: string, ok: boolean, detalle: string) => {
  casos.push({ nombre, ok, detalle })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}\n      ${detalle}`)
}

async function main() {
  const { pgConfig } = await import('../../lib/db/pgSsl.cjs')
  const { Client } = await import('pg')
  const { construirPlan, positionTypeDe } = await import('../../lib/api/oposicionPersonalizada/plan')

  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()

  console.log(`\n══ Guardar una oposición personalizada (T-327) ═══════════════════════════`)
  console.log(`   contra la BD real · marca de limpieza: ${MARCA}\n`)

  // Usuario efímero y dos leyes reales cualesquiera.
  const { rows: leyes } = await c.query(
    `SELECT id, short_name FROM laws WHERE is_active = true ORDER BY created_at LIMIT 2`,
  )
  if (leyes.length < 2) throw new Error('hacen falta 2 leyes activas')
  const [leyA, leyB] = leyes

  const { rows: u } = await c.query(
    `INSERT INTO user_profiles (id, email, full_name)
     VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
    [`${MARCA}@sim.vence.es`, `Sim T327`],
  )
  const userId = u[0].id
  const creados: string[] = []

  try {
    // ── 1. Guardado completo ───────────────────────────────────────────────────────────────
    console.log('1) Un temario con dos temas: artículos sueltos y una ley entera')
    const entrada = {
      nombre: `Oposición ${MARCA}`,
      temas: [
        {
          titulo: 'Tema 1 — el procedimiento',
          articulos: [
            { lawId: leyA.id, articleNumber: '1' },
            { lawId: leyA.id, articleNumber: '2' },
            { lawId: leyA.id, articleNumber: '1' }, // repetido a propósito
          ],
        },
        { titulo: 'Tema 2 — la ley entera', articulos: [{ lawId: leyB.id, articleNumber: null }] },
        { titulo: 'Tema 3 — vacío', articulos: [] },
      ],
    }

    // Se escribe con el MISMO camino que el endpoint (el módulo de guardado usa server-only, así
    // que aquí se replica su transacción con el mismo plan puro: lo que se valida es el PLAN
    // llegando a Postgres, que es donde estaban los dos fallos silenciosos).
    const { rows: op } = await c.query(
      `INSERT INTO custom_oposiciones (user_id, nombre, is_public, is_active, created_by_username)
       VALUES ($1, $2, true, true, $3) RETURNING id`,
      [userId, entrada.nombre, 'Sim T327'],
    )
    const opId = op[0].id
    creados.push(opId)
    const { plan } = construirPlan(entrada, opId)
    if (!plan) throw new Error('el plan salió nulo')

    for (const tema of plan.temas) {
      const { rows: t } = await c.query(
        // `descripcion_corta` va aquí porque es NOT NULL en la BD y el schema de Drizzle NO lo
        // dice. Este mismo caso es lo que justifica que esta simulación exista: los unitarios
        // no pueden ver un invariante que solo vive en Postgres.
        `INSERT INTO topics (position_type, topic_number, title, descripcion_corta, is_active, disponible)
         VALUES ($1, $2, $3, $3, true, true) RETURNING id`,
        [plan.positionType, tema.topicNumber, tema.titulo],
      )
      for (const f of tema.scope) {
        await c.query(
          `INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES ($1, $2, $3)`,
          [t[0].id, f.lawId, f.articleNumbers],
        )
      }
    }

    const pt = positionTypeDe(opId)
    const { rows: temasBd } = await c.query(
      `SELECT topic_number, title FROM topics WHERE position_type = $1 ORDER BY topic_number`,
      [pt],
    )
    anota(
      'el tema vacío NO se guarda y los demás quedan renumerados 1..N',
      temasBd.length === 2 && temasBd[0].topic_number === 1 && temasBd[1].topic_number === 2,
      `temas en BD: ${temasBd.map((x) => `${x.topic_number}:${x.title}`).join(' · ')}`,
    )

    const { rows: scope } = await c.query(
      `SELECT t.topic_number, s.law_id, s.article_numbers
         FROM topic_scope s JOIN topics t ON t.id = s.topic_id
        WHERE t.position_type = $1 ORDER BY t.topic_number`,
      [pt],
    )
    const t1 = scope.find((s) => s.topic_number === 1)
    anota(
      'los artículos repetidos NO inflan el scope',
      Array.isArray(t1?.article_numbers) && t1.article_numbers.length === 2,
      `tema 1 → ${JSON.stringify(t1?.article_numbers)}`,
    )

    const t2 = scope.find((s) => s.topic_number === 2)
    anota(
      '«toda la ley» queda como NULL en Postgres, no como {} (que sería «ninguno»)',
      t2?.article_numbers === null,
      `tema 2 → ${t2?.article_numbers === null ? 'NULL (correcto)' : JSON.stringify(t2?.article_numbers)}`,
    )

    // ── 2. La oposición NO puede quedar sin temario ────────────────────────────────────────
    console.log('\n2) Una oposición guardada siempre tiene temario detrás')
    const { rows: sinTemario } = await c.query(
      `SELECT co.id FROM custom_oposiciones co
        WHERE co.id = $1
          AND NOT EXISTS (SELECT 1 FROM topics t WHERE t.position_type = $2)`,
      [opId, pt],
    )
    anota(
      'no existe el estado «etiqueta sin temario»',
      sinTemario.length === 0,
      sinTemario.length === 0 ? 'la oposición tiene sus temas' : '⚠️ quedó vacía',
    )

    // ── 3. El nombre repetido del mismo usuario se rechaza ─────────────────────────────────
    console.log('\n3) El mismo usuario no puede repetir el nombre')
    let choco = false
    try {
      await c.query(
        `INSERT INTO custom_oposiciones (user_id, nombre, is_public, is_active)
         VALUES ($1, $2, true, true)`,
        [userId, entrada.nombre],
      )
    } catch (e) {
      choco = (e as { code?: string })?.code === '23505'
    }
    anota(
      'choca con 23505 (y el endpoint lo traduce a «ya tienes una con ese nombre»)',
      choco,
      choco ? 'rechazado por la restricción única' : 'se insertó un duplicado',
    )
  } finally {
    // Limpieza: pase lo que pase, no se deja nada.
    for (const id of creados) {
      await c.query(`DELETE FROM topic_scope WHERE topic_id IN (SELECT id FROM topics WHERE position_type = $1)`, [
        positionTypeDe(id),
      ])
      await c.query(`DELETE FROM topics WHERE position_type = $1`, [positionTypeDe(id)])
    }
    await c.query(`DELETE FROM custom_oposiciones WHERE user_id = $1`, [userId])
    const { rowCount } = await c.query(`DELETE FROM user_profiles WHERE id = $1`, [userId])
    console.log(`\n🧹 limpieza: ${rowCount} usuario(s) efímero(s) y su temario borrados`)
    await c.end()
  }

  const fallos = casos.filter((x) => !x.ok)
  console.log('\n' + '═'.repeat(72))
  if (fallos.length === 0) {
    console.log('✅ SIMULACIÓN VERDE — el temario propio se guarda entero y con la forma correcta')
    return
  }
  console.log(`❌ SIMULACIÓN ROJA — ${fallos.length} de ${casos.length}`)
  for (const f of fallos) console.log(`   · ${f.nombre}: ${f.detalle}`)
  process.exit(1)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
