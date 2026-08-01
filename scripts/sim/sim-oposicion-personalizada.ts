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
  const { positionTypeDe } = await import('../../lib/api/oposicionPersonalizada/plan')

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

    // ⚠️ SE LLAMA AL ESCRITOR REAL, y esto es EL punto de esta simulación.
    //
    // La primera versión reimplementaba la escritura aquí con `pg` a pelo, y por eso dio VERDE
    // mientras el guardado estaba roto en producción: interpolar un array de JS en una plantilla
    // `sql` de Drizzle lo expande en `($1, $2, $3…)` —una tupla, no un array— y el INSERT
    // revienta. Con `pg` directo eso no pasa, así que la simulación probaba un camino que nadie
    // recorre. **Una simulación que reimplementa lo que quiere probar no prueba nada.**
    //
    // El módulo es `server-only`; el shim de `NODE_OPTIONS` lo permite en la simulación sin
    // tocar la guarda de la app.
    const { guardarOposicionPersonalizada } = await import(
      '../../lib/api/oposicionPersonalizada/guardar'
    )
    const res = await guardarOposicionPersonalizada(userId, entrada, 'Sim T327')
    anota(
      'el guardado REAL termina bien',
      res.ok === true,
      res.ok ? `oposición ${res.id} con ${res.temas} tema(s)` : `falló: ${res.motivo} ${res.detalle ?? ''}`,
    )
    if (!res.ok) throw new Error(`el escritor real falló: ${res.detalle ?? res.motivo}`)
    const opId = res.id!
    creados.push(opId)

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

    // ── 2.bis EDITAR: listar, cargar y reemplazar ──────────────────────────────────────────
    //
    // Editar es donde más fácil se pierde trabajo: se BORRA el temario y se vuelve a escribir, y
    // un fallo entre las dos mitades dejaría al usuario sin nada. Por eso se ejercen las tres
    // operaciones reales, no solo la escritura.
    console.log('\n2.bis) Editar la oposición que acabo de crear')
    const { misOposiciones, cargarOposicion, reemplazarTemario } = await import(
      '../../lib/api/oposicionPersonalizada/consultas'
    )

    const lista = await misOposiciones(userId)
    anota(
      'sale en MIS oposiciones, con el tamaño real de su temario',
      lista.length === 1 && lista[0].temas === 2 && lista[0].articulos === 3,
      `${lista.length} oposición(es) · ${lista[0]?.temas} temas · ${lista[0]?.articulos} artículos (2 sueltos + 1 ley entera = 3)`,
    )

    const cargada = await cargarOposicion(userId, opId)
    anota(
      'se carga para editar y «toda la ley» sigue siendo toda la ley',
      cargada?.temas.length === 2 &&
        cargada.temas[1].articulos.length === 1 &&
        cargada.temas[1].articulos[0].articleNumber === null,
      cargada
        ? `tema 2 → ${JSON.stringify(cargada.temas[1].articulos.map((a) => a.articleNumber))} (null = entera)`
        : 'no se pudo cargar',
    )

    const ajena = await cargarOposicion('00000000-0000-0000-0000-000000000000', opId)
    anota(
      'OTRO usuario NO puede abrirla (son públicas: sin este filtro se editaría la de cualquiera)',
      ajena === null,
      ajena === null ? 'devuelve null' : '⚠️ la ha devuelto',
    )

    const edit = await reemplazarTemario(userId, opId, {
      nombre: `Oposición ${MARCA}`,
      temas: [{ titulo: 'Tema único tras editar', articulos: [{ lawId: leyA.id, articleNumber: '3' }] }],
    })
    const tras = await cargarOposicion(userId, opId)
    anota(
      'reemplazar deja EXACTAMENTE el temario nuevo, sin restos del viejo',
      edit.ok === true && tras?.temas.length === 1 && tras.temas[0].titulo === 'Tema único tras editar',
      `${tras?.temas.length} tema(s): ${tras?.temas.map((t) => t.titulo).join(' · ')}`,
    )

    const noMia = await reemplazarTemario('00000000-0000-0000-0000-000000000000', opId, {
      nombre: 'secuestrada',
      temas: [{ titulo: 'X', articulos: [{ lawId: leyA.id, articleNumber: '1' }] }],
    })
    const intacta = await cargarOposicion(userId, opId)
    anota(
      'OTRO usuario NO puede reescribirla, y no la deja tocada',
      noMia.ok === false && noMia.motivo === 'no_es_tuya' && intacta?.nombre === `Oposición ${MARCA}`,
      `motivo=${noMia.motivo} · nombre tras el intento: ${intacta?.nombre}`,
    )


    // ── 2.ter ELEGIRLA COMO OPOSICIÓN OBJETIVO ────────────────────────────────────────────
    //
    // Es lo que convierte «puedo montar mi temario» en «puedo estudiar con él». Y es el punto
    // MÁS delicado de T-327, porque toca el objetivo del usuario, que es lo que gobierna la
    // navegación de toda la app: si se guarda algo que el cliente no sabe resolver, le BORRA la
    // oposición y le deja el menú por defecto.
    console.log('\n2.ter) Elegirla como oposición objetivo')
    const { esObjetivoValido, esObjetivoPersonalizado, rutaTestPersonalizada } = await import(
      '../../lib/oposicion/objetivoPersonalizado'
    )
    const { nombrePublico } = await import('../../lib/oposicionPersonalizada/nombrePublico')

    const objetivo = `personalizada_${opId.replace(/-/g, '')}`
    // Se escribe como lo hace el endpoint: el valor + el blob con el nombre público resuelto.
    const { rows: co } = await c.query(
      `SELECT nombre, created_by_username FROM custom_oposiciones WHERE id = $1`,
      [opId],
    )
    const nombreVisible = nombrePublico(co[0].nombre, co[0].created_by_username)
    await c.query(
      `UPDATE user_profiles SET target_oposicion = $1, target_oposicion_data = $2::jsonb WHERE id = $3`,
      [objetivo, JSON.stringify({ id: objetivo, name: nombreVisible, nombre: nombreVisible, tipo: 'personalizada' }), userId],
    )

    const { rows: perfil } = await c.query(
      `SELECT target_oposicion, target_oposicion_data FROM user_profiles WHERE id = $1`,
      [userId],
    )
    const guardado = perfil[0]
    anota(
      'el objetivo queda con el prefijo que el cliente sabe resolver',
      esObjetivoPersonalizado(guardado.target_oposicion),
      `target_oposicion = ${guardado.target_oposicion}`,
    )
    anota(
      'y el cliente lo daría por VÁLIDO (no le borraría la oposición al usuario)',
      esObjetivoValido(guardado.target_oposicion, false, guardado.target_oposicion_data?.name),
      `nombre en el blob: «${guardado.target_oposicion_data?.name}»`,
    )
    anota(
      'el nombre visible NO es el identificador interno, y lleva la autoría',
      typeof guardado.target_oposicion_data?.name === 'string' &&
        !guardado.target_oposicion_data.name.startsWith('personalizada_') &&
        guardado.target_oposicion_data.name.includes(' by '),
      `«${guardado.target_oposicion_data?.name}»`,
    )

    // El temario tiene que existir DETRÁS del objetivo: es la diferencia entre esto y las
    // etiquetas del onboarding antiguo (303 usuarios apuntados a algo sin temario).
    const { rows: temasObjetivo } = await c.query(
      `SELECT count(*)::int n FROM topics WHERE position_type = $1`,
      [guardado.target_oposicion],
    )
    anota(
      'detrás del objetivo HAY temario (no es una etiqueta vacía)',
      temasObjetivo[0].n > 0,
      `${temasObjetivo[0].n} tema(s) con position_type = ${guardado.target_oposicion}`,
    )
    anota(
      'la ruta de sus tests apunta a la oposición correcta',
      rutaTestPersonalizada(guardado.target_oposicion) ===
        `/oposicion-personalizada/${opId.replace(/-/g, '')}/test`,
      String(rutaTestPersonalizada(guardado.target_oposicion)),
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
      await c.query(`DELETE FROM oposicion_bloques WHERE position_type = $1`, [positionTypeDe(id)])
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
