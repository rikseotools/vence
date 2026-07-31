#!/usr/bin/env node
// scripts/calidad/duplicados-exactos.cjs
//
// Duplicados EXACTOS del banco de preguntas: simula primero, jubila después. [T-321 · T-410]
//
//   node scripts/calidad/duplicados-exactos.cjs                      # simula TODO el banco
//   node scripts/calidad/duplicados-exactos.cjs --dia 2026-03-21     # solo el lote de ese día
//   node scripts/calidad/duplicados-exactos.cjs --dia 2026-03-21 --aplicar
//   node scripts/calidad/duplicados-exactos.cjs --banco psicotecnicas
//   node scripts/calidad/duplicados-exactos.cjs --banco psicotecnicas --parafraseadas
//
// ## Los dos bancos, un solo criterio (31/07/2026, T-410)
//
// El 31/07 tres sesiones atacaron el mismo hueco sin verse: este barrido (legislativas), la
// ficha T-408 —que lo dio por inexistente porque `tools:buscar -- duplicadas` no casa con
// «duplicados»— y las psicotécnicas duplicadas que destapó la impugnación `b6787619`. En vez
// de un cuarto script, el banco psicotécnico entra AQUÍ y el criterio vive en un módulo puro
// compartido: `lib/calidad/duplicados.js` (con tests). Dos puertas al mismo recurso con
// criterios distintos no protegen — se contradicen.
//
// Lo que cambia entre bancos, y por qué:
//
// | | legislativas (`questions`) | psicotécnicas (`psychometric_questions`) |
// |---|---|---|
// | agrupa por | artículo + enunciado + opciones | enunciado + opciones + **huella de imagen/`content_data`** |
// | jubila con | `retired_duplicate` (lifecycle, TERMINAL) | `is_active=false` + `deactivation_reason` (no hay lifecycle) |
// | protege | que un artículo no baje de 4 preguntas | que una SECCIÓN no baje de 4 |
//
// La huella no es un adorno: sin ella, 95 de los 98 grupos de psicotécnicas son preguntas
// DISTINTAS que solo comparten un enunciado genérico («Observa la secuencia…») y se
// diferencian en la figura. Con ella quedan 3, que es la medida real.
//
// ## Por qué existe (31/07/2026)
//
// Lo destapó Marta (premium) con tres impugnaciones de «pregunta repetida» el mismo día: dos
// eran duplicados reales de Windows 10, con las opciones reordenadas. Al medir el banco
// salieron **2.030 preguntas sobrantes**, y la mayoría entraron en dos días concretos —
// importaciones que no comprobaron si la pregunta ya estaba.
//
// ## Las dos trampas de este trabajo, y cómo las evita el script
//
// 1. **Una métrica de parecido NO sirve para borrar.** El primer barrido de T-321 usó «solape
//    de palabras ≥75%» y dio 3.230 pares; al mirarlos, los peores eran **casos prácticos**:
//    preguntas distintas que comparten el enunciado del supuesto POR DISEÑO. Aquí el criterio
//    es estricto — mismo artículo, enunciado idéntico normalizado y **las mismas cuatro
//    opciones** — y además se excluyen los supuestos (`exam_case_id`).
// 2. **`retired_duplicate` es TERMINAL**: la máquina de estados no deja volver. Por eso lo
//    normal es simular, leer la salida y solo entonces pasar `--aplicar`.
//
// ## A quién se conserva (en este orden)
//
//   1. **La de examen oficial**, si la hay — esa no se toca nunca.
//   2. La de explicación estructurada (se puede barajar).
//   3. La más servida, y a igualdad, la más antigua (tiene el historial de respuestas).

require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { sqlNormalizar, decidirSuperviviente, bandaGrupo, esJuegoGenerico, unidoSoloPorTildes } = require('../../lib/calidad/duplicados.js')

const argv = process.argv.slice(2)
const valor = (f) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}
const DIA = valor('--dia')
const APLICAR = argv.includes('--aplicar')
const LIMITE = parseInt(valor('--limite') || '0', 10)
const BANCO = valor('--banco') || 'legislativas'
const PARAFRASEADAS = argv.includes('--parafraseadas')

if (!['legislativas', 'psicotecnicas', 'ambos'].includes(BANCO)) {
  console.error(`❌ --banco debe ser legislativas | psicotecnicas | ambos (recibido: ${BANCO})`)
  process.exit(2)
}

const SQL_GRUPOS = `
  with base as (
    select q.id, q.question_text, q.correct_option, q.created_at, q.is_official_exam,
           q.explanation, q.primary_article_id, q.lifecycle_state,
           lower(regexp_replace(q.question_text, '\\s+', ' ', 'g')) as norm,
           (select string_agg(x, '|' order by x) from unnest(array[
              lower(trim(q.option_a)), lower(trim(q.option_b)),
              lower(trim(q.option_c)), lower(trim(q.option_d))]) x) as ops,
           (select count(*)::int from test_questions t where t.question_id = q.id) as servida
      from questions q
     where q.is_active
       and q.primary_article_id is not null
       and q.exam_case_id is null          -- los supuestos comparten enunciado POR DISEÑO
  )
  select norm, primary_article_id, ops, count(*)::int n,
         max(created_at) as ultima,
         json_agg(json_build_object(
           'id', id, 'oficial', is_official_exam, 'servida', servida,
           'expl', coalesce(length(explanation), 0), 'alta', created_at, 'estado', lifecycle_state
         ) order by created_at) as miembros
    from base
   group by 1, 2, 3
  having count(*) > 1`

/**
 * Devuelve [superviviente, ...aJubilar]. El criterio vive en `lib/calidad/duplicados.js`
 * (testeado) para que legislativas y psicotécnicas conserven la copia por la misma regla.
 */
const decidir = decidirSuperviviente

async function barridoLegislativas(c) {
  const { rows } = await c.query(SQL_GRUPOS)
  // `ultima` llega como objeto Date: convertir a ISO antes de comparar. Con String() se
  // obtiene «Sat Mar 21 2026…» y el filtro no casaba nunca (daba 0 grupos en silencio).
  const dia = (v) => new Date(v).toISOString().slice(0, 10)
  const grupos = rows.filter((g) => !DIA || dia(g.ultima) === DIA)

  let jubilar = []
  let conOficial = 0
  const porArticulo = new Map()
  for (const g of grupos) {
    const [queda, fuera] = decidir(g.miembros)
    if (queda.oficial) conOficial++
    jubilar.push(...fuera.map((f) => ({ ...f, quedaId: queda.id, articulo: g.primary_article_id })))
    porArticulo.set(g.primary_article_id, (porArticulo.get(g.primary_article_id) || 0) + fuera.length)
  }
  if (LIMITE) jubilar = jubilar.slice(0, LIMITE)

  // Un artículo no puede quedarse sin preguntas servibles: eso cambia un problema
  // (repetición) por otro peor (un tema que no da ni para un test). Se apartan y se revisan
  // aparte — el objetivo es un banco sano, no un contador de duplicados a cero.
  const MINIMO = 4
  const { rows: totales } = await c.query(
    `select primary_article_id aid, count(*)::int total from questions
      where is_active and primary_article_id = any($1) group by 1`,
    [[...porArticulo.keys()]])
  const totalPorArt = new Map(totales.map((r) => [r.aid, r.total]))
  const protegidos = new Set(
    [...porArticulo.entries()]
      .filter(([aid, quita]) => (totalPorArt.get(aid) || 0) - quita < MINIMO)
      .map(([aid]) => aid))
  const apartadas = jubilar.filter((j) => protegidos.has(j.articulo)).length
  jubilar = jubilar.filter((j) => !protegidos.has(j.articulo))

  console.log(`\n═══ DUPLICADOS EXACTOS${DIA ? ` · lote del ${DIA}` : ' · TODO el banco'} ═══`)
  console.log(`  grupos: ${grupos.length}`)
  console.log(`  a jubilar: ${jubilar.length}${apartadas ? ` (${apartadas} apartadas para no dejar un artículo por debajo de ${MINIMO})` : ''}`)
  console.log(`  grupos donde la superviviente es de EXAMEN OFICIAL: ${conOficial}`)

  // Ningún artículo puede quedarse sin preguntas servibles por culpa de esto.
  const arts = [...porArticulo.entries()]
  if (arts.length) {
    const { rows: cuenta } = await c.query(
      `select primary_article_id aid, count(*)::int total from questions
        where is_active and primary_article_id = any($1) group by 1`,
      [arts.map(([a]) => a)])
    const mapa = new Map(cuenta.map((r) => [r.aid, r.total]))
    const criticos = arts
      .map(([aid, quita]) => ({ aid, quita, queda: (mapa.get(aid) || 0) - quita }))
      .filter((x) => x.queda < 4)
      .sort((a, b) => a.queda - b.queda)
    console.log(`  artículos que se quedarían por debajo de 4 preguntas: ${criticos.length}`)
    criticos.slice(0, 8).forEach((x) =>
      console.log(`     · ${String(x.aid).slice(0, 8)} — quedan ${x.queda} (se van ${x.quita})`))
  }

  if (!APLICAR) {
    console.log('\n  (simulación: no se ha tocado nada — añade --aplicar para jubilar)\n')
    return
  }

  console.log('\n  aplicando…')
  const { rows: adm } = await c.query("select id from user_profiles where email='manueltrader@gmail.com'")
  let ok = 0, fallos = 0
  for (const j of jubilar) {
    try {
      await c.query('select public.transition_question_state($1,$2,$3,$4,$5,null,$6)', [
        j.id, j.estado, 'retired_duplicate', 'admin_duplicate_of', adm[0].id,
        `Duplicado exacto de ${j.quedaId} (mismo articulo, mismo enunciado y las mismas 4 opciones). ` +
        `Se conserva la otra por: oficial > explicacion estructurada > mas servida > mas antigua. ` +
        `Barrido T-321${DIA ? `, lote del ${DIA}` : ''}.`,
      ])
      ok++
    } catch (e) {
      fallos++
      if (fallos <= 3) console.log(`     ⚠️ ${String(j.id).slice(0, 8)}: ${e.message.slice(0, 90)}`)
    }
  }
  console.log(`  jubiladas: ${ok} · fallos: ${fallos}\n`)
}

// ── Psicotécnicas ────────────────────────────────────────────────────────────────────────
//
// Mismo criterio, dos diferencias que impone la tabla: aquí NO hay lifecycle (se desactiva
// con `is_active=false` + `deactivation_reason`, que es reversible, al revés que
// `retired_duplicate`) y el contenido no siempre está en el texto — vive en `content_data`
// o en la imagen, así que la huella de ambos entra en la clave del grupo.

const N = (col) => sqlNormalizar(col)

const SQL_PSICO = `
  with base as (
    select q.id, q.question_text, q.correct_option, q.created_at, q.is_official_exam,
           q.explanation, q.section_id,
           ${N('q.question_text')} as norm,
           (select string_agg(x, '|' order by x) from unnest(array[
              ${N('q.option_a')}, ${N('q.option_b')}, ${N('q.option_c')},
              ${N('q.option_d')}, ${N('q.option_e')}]) x where x <> '') as ops,
           -- content_data es jsonb: Postgres ya devuelve las claves ordenadas, así que dos
           -- rejillas iguales dan la misma huella aunque se escribieran en distinto orden.
           md5(coalesce(q.image_url, '') || '#' || coalesce(q.content_data::text, '')) as huella,
           (array[q.option_a, q.option_b, q.option_c, q.option_d, q.option_e])[q.correct_option + 1] as texto_correcta,
           array[q.option_a, q.option_b, q.option_c, q.option_d, q.option_e] as opciones,
           (select count(*)::int from psychometric_test_answers a where a.question_id = q.id) as servida
      from psychometric_questions q
     where q.is_active
  )
  select norm, ops, huella, count(*)::int n,
         json_agg(json_build_object(
           'id', id, 'oficial', is_official_exam, 'servida', servida,
           'expl', coalesce(length(explanation), 0), 'alta', created_at,
           'seccion', section_id, 'textoCorrecta', texto_correcta, 'opciones', opciones
         ) order by created_at) as miembros
    from base
   group by 1, 2, 3
  having count(*) > 1`

async function barridoPsicotecnicas(c) {
  const { rows: grupos } = await c.query(SQL_PSICO)

  let jubilar = []
  let conOficial = 0
  let conClaveDistinta = 0
  const porTilde = []
  const porSeccion = new Map()
  for (const g of grupos) {
    // Si al grupo lo unió QUITAR LA TILDE, no se aplica solo: en un banco que examina ortografía
    // la tilde puede ser lo que la pregunta pregunta. Se aparta para mirarlo a mano.
    if (unidoSoloPorTildes(g.miembros.map((m) => m.opciones))) { porTilde.push(g); continue }
    const [queda, fuera] = decidir(g.miembros)
    if (queda.oficial) conOficial++
    if (bandaGrupo(g.miembros) === 'error') conClaveDistinta++
    jubilar.push(...fuera.map((f) => ({ ...f, quedaId: queda.id })))
    for (const f of fuera) porSeccion.set(f.seccion, (porSeccion.get(f.seccion) || 0) + 1)
  }
  if (LIMITE) jubilar = jubilar.slice(0, LIMITE)

  // Misma guarda que en legislativas, con la sección haciendo de artículo: cambiar
  // «repetida» por «sección que no da ni para un test» no es una mejora.
  const MINIMO = 4
  const secciones = [...porSeccion.keys()].filter(Boolean)
  const protegidas = new Set()
  if (secciones.length) {
    const { rows: totales } = await c.query(
      `select section_id sid, count(*)::int total from psychometric_questions
        where is_active and section_id = any($1) group by 1`, [secciones])
    const mapa = new Map(totales.map((r) => [r.sid, r.total]))
    for (const [sid, quita] of porSeccion.entries()) {
      if (sid && (mapa.get(sid) || 0) - quita < MINIMO) protegidas.add(sid)
    }
  }
  const apartadas = jubilar.filter((j) => protegidas.has(j.seccion)).length
  jubilar = jubilar.filter((j) => !protegidas.has(j.seccion))

  console.log('\n═══ DUPLICADOS EXACTOS · PSICOTÉCNICAS ═══')
  console.log(`  grupos: ${grupos.length}`)
  console.log(`  a desactivar: ${jubilar.length}${apartadas ? ` (${apartadas} apartadas para no dejar una sección por debajo de ${MINIMO})` : ''}`)
  console.log(`  grupos donde la superviviente es de EXAMEN OFICIAL: ${conOficial}`)
  console.log(`  grupos cuyas gemelas RESPONDEN COSAS DISTINTAS: ${conClaveDistinta}${conClaveDistinta ? '  ← mirar estos primero' : ''}`)
  if (porTilde.length) {
    console.log(`  ⚠️ apartados por unirse SOLO al quitar la tilde (mira el enunciado: puede ser una pregunta de ortografía): ${porTilde.length}`)
    for (const g of porTilde) console.log(`     · ${g.miembros.map((m) => String(m.id).slice(0, 8)).join(' / ')}`)
  }
  for (const g of grupos.slice(0, 10)) {
    const [queda, fuera] = decidir(g.miembros)
    console.log(`     · ${bandaGrupo(g.miembros) === 'error' ? '🔴' : '·'} queda ${String(queda.id).slice(0, 8)} — se van ${fuera.map((f) => String(f.id).slice(0, 8)).join(', ')}`)
  }

  if (!APLICAR) {
    console.log('\n  (simulación: no se ha tocado nada — añade --aplicar para desactivar)\n')
    return
  }

  console.log('\n  aplicando…')
  let ok = 0, fallos = 0
  for (const j of jubilar) {
    try {
      await c.query(
        `update psychometric_questions
            set is_active = false, deactivation_reason = $2, updated_at = now()
          where id = $1 and is_active`,
        [j.id,
         `duplicate_of:${j.quedaId} (mismo enunciado, mismas opciones barajadas y mismo contenido; ` +
         `se conserva la otra por: oficial > explicacion > mas servida > mas antigua. Barrido T-410).`])
      ok++
    } catch (e) {
      fallos++
      if (fallos <= 3) console.log(`     ⚠️ ${String(j.id).slice(0, 8)}: ${e.message.slice(0, 90)}`)
    }
  }
  console.log(`  desactivadas: ${ok} · fallos: ${fallos}\n`)
}

// ── Cola parafraseada (solo listado, NUNCA escribe) ──────────────────────────────────────
//
// Mismas opciones, enunciado redactado distinto. Es la clase que la deduplicación de mayo no
// podía ver, y la que destapó la impugnación `b6787619`. NO se aplica en bloque: aquí la
// única evidencia son las opciones, así que hay falsos positivos reales (preguntas de tabla
// que comparten juego de opciones). Sale la lista y se adjudica a mano — T-410.

const SQL_PARAFRASEADAS = `
  with base as (
    select q.id, q.question_text, q.is_official_exam,
           ${N('q.question_text')} as norm,
           (select string_agg(x, '|' order by x) from unnest(array[
              ${N('q.option_a')}, ${N('q.option_b')}, ${N('q.option_c')},
              ${N('q.option_d')}, ${N('q.option_e')}]) x where x <> '') as ops,
           (array[q.option_a, q.option_b, q.option_c, q.option_d, q.option_e])[q.correct_option + 1] as texto_correcta
      from psychometric_questions q
     where q.is_active
  )
  select ops, count(*)::int n, count(distinct norm)::int textos,
         json_agg(json_build_object('id', id, 'texto', left(question_text, 70),
                                    'oficial', is_official_exam, 'textoCorrecta', texto_correcta)) as miembros
    from base
   group by 1
  having count(*) > 1 and count(distinct norm) > 1
   order by count(*) desc`

async function listadoParafraseadas(c) {
  const { rows } = await c.query(SQL_PARAFRASEADAS)
  const utiles = rows.filter((g) => !esJuegoGenerico(g.ops))
  const descartados = rows.length - utiles.length

  console.log('\n═══ CANDIDATOS PARAFRASEADOS · PSICOTÉCNICAS (solo listado) ═══')
  console.log(`  grupos: ${utiles.length}  (${descartados} descartados por juego de opciones genérico)`)
  console.log(`  preguntas implicadas: ${utiles.reduce((a, g) => a + g.n, 0)} · sobrantes si se confirman: ${utiles.reduce((a, g) => a + g.n - 1, 0)}`)
  console.log(`  grupos cuyas copias RESPONDEN COSAS DISTINTAS: ${utiles.filter((g) => bandaGrupo(g.miembros) === 'error').length}`)
  console.log('')
  for (const g of utiles) {
    console.log(`  ${bandaGrupo(g.miembros) === 'error' ? '🔴' : '·'} ${g.miembros.map((m) => String(m.id).slice(0, 8)).join(' / ')}`)
    for (const m of g.miembros) console.log(`      ${m.oficial ? '[oficial] ' : ''}${JSON.stringify(m.texto)}`)
  }
  console.log('\n  (listado: no se ha tocado nada — se adjudica a mano, ver T-410)\n')
}

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.split('?')[0],
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()
  try {
    if (PARAFRASEADAS) {
      await listadoParafraseadas(c)
      return
    }
    if (BANCO === 'legislativas' || BANCO === 'ambos') await barridoLegislativas(c)
    if (BANCO === 'psicotecnicas' || BANCO === 'ambos') await barridoPsicotecnicas(c)
  } finally {
    await c.end()
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
