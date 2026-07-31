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
//   node scripts/calidad/duplicados-exactos.cjs --banco legislativas --parafraseadas   # T-425
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
// El `sslmode` de la URL PISA la opción `ssl` en `pg`: la receta va en un solo sitio.
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { sqlNormalizar, decidirSuperviviente, bandaGrupo, esJuegoGenerico, unidoSoloPorTildes,
        compararEnunciados, bandaParafraseada, mismaRespuesta, corteAcumulado,
        mismoOrdenDeContenido } = require('../../lib/calidad/duplicados.js')

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
// Ordena los grupos por veces servidas y marca el corte del 80% de la exposición. No es un extra
// informativo: es lo que decide POR DÓNDE se empieza a adjudicar (T-425, decisión de Manuel 31/07).
const POR_EXPOSICION = argv.includes('--por-exposicion')
// Vuelca los grupos con los enunciados ENTEROS. El listado de pantalla trunca a 150 caracteres y
// con eso no se puede adjudicar: la diferencia que decide suele estar al final de la frase.
const JSON_OUT = argv.includes('--json')
// Fichero con la adjudicación ya hecha a mano. Simula salvo que se añada --aplicar.
const ADJUDICADOS = valor('--adjudicados')

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

// ── Cola parafraseada · LEGISLATIVAS (solo listado, NUNCA escribe) ──────────────────────
//
// Misma idea que el listado de psicotécnicas, pero el ruido de este banco es OTRO y hace falta
// una segunda señal. Ver el bloque de `lib/calidad/duplicados.js` para los números medidos: el
// juego de opciones por sí solo da 3.376 grupos casi todos legítimos (series de variante:
// `polvorín semienterrado`/`superficial`, `ingreso`/`reintegro`, tramos de una tabla), así que
// aquí se cruza con el parecido del enunciado y el número absoluto de palabras distintas.
//
// Se excluyen los supuestos (`exam_case_id`) por el mismo motivo que en el corte exacto:
// comparten enunciado POR DISEÑO. Sin esa guarda, la banda alta se llena de casos clínicos.

const SQL_PARAFRASEADAS_LEG = `
  with base as (
    select q.id, q.question_text, q.is_official_exam, q.primary_article_id, q.created_at,
           q.lifecycle_state, length(coalesce(q.explanation,'')) as expl,
           ${N('q.question_text')} as norm,
           (select string_agg(x, '|' order by x) from unnest(array[
              ${N('q.option_a')}, ${N('q.option_b')}, ${N('q.option_c')}, ${N('q.option_d')}]) x
             where x <> '') as ops,
           (array[q.option_a, q.option_b, q.option_c, q.option_d])[q.correct_option + 1] as texto_correcta
      from questions q
     where q.is_active
       and q.exam_case_id is null          -- los supuestos comparten enunciado POR DISEÑO
       and q.primary_article_id is not null
  )
  select ops, primary_article_id as art, count(*)::int n,
         json_agg(json_build_object('id', id, 'texto', question_text, 'oficial', is_official_exam,
                                    'alta', created_at, 'textoCorrecta', texto_correcta,
                                    'estado', lifecycle_state, 'expl', expl)) as miembros
    from base
   where ops is not null and ops <> ''
   group by ops, primary_article_id
  having count(*) > 1 and count(distinct norm) > 1`

/** Pareja más gemela del grupo: más solape y, a igualdad, menos palabras distintas. */
function mejorPareja(miembros) {
  let mejor = null
  for (let i = 0; i < miembros.length; i++) {
    for (let j = i + 1; j < miembros.length; j++) {
      const m = compararEnunciados(miembros[i].texto, miembros[j].texto)
      if (!mejor || m.solape > mejor.solape || (m.solape === mejor.solape && m.distintas < mejor.distintas)) {
        mejor = { ...m, a: miembros[i], b: miembros[j] }
      }
    }
  }
  return mejor
}

/**
 * Cuántas veces se ha servido cada copia (`test_questions`). Es la medida que ordena el trabajo:
 * el daño de un duplicado no es existir, es que a la MISMA persona le salgan los dos.
 */
async function anotarExposicion(c, grupos) {
  const ids = [...new Set(grupos.flatMap((g) => g.miembros.map((m) => m.id)))]
  if (!ids.length) return
  const { rows } = await c.query(
    `select question_id, count(*)::int veces from test_questions
      where question_id = any($1::uuid[]) group by question_id`, [ids])
  const porId = new Map(rows.map((r) => [r.question_id, r.veces]))
  for (const g of grupos) {
    for (const m of g.miembros) m.veces = porId.get(m.id) || 0
    g.expuesta = g.miembros.reduce((a, m) => a + m.veces, 0)
    // Servidas ≥2 copias = ya hay usuarios que se han encontrado la repetición.
    g.copiasServidas = g.miembros.filter((m) => m.veces > 0).length
  }
}

async function listadoParafraseadasLegislativas(c) {
  const { rows } = await c.query(SQL_PARAFRASEADAS_LEG)
  const grupos = []
  for (const g of rows) {
    const par = mejorPareja(g.miembros)
    if (!par) continue
    const banda = bandaParafraseada({
      solape: par.solape,
      distintas: par.distintas,
      mismaRespuesta: mismaRespuesta(par.a.textoCorrecta, par.b.textoCorrecta),
    })
    // La guarda del orden no cambia la banda: marca la pareja que NO se puede dar por mecánica
    // aunque el conjunto de palabras coincida (T-439). Quien adjudique tiene que leerla entera.
    if (banda) grupos.push({ ...g, par, banda, ordenDistinto: !mismoOrdenDeContenido(par.a.texto, par.b.texto) })
  }
  const gemelas = grupos.filter((g) => g.banda === 'gemela').sort((x, y) => y.par.solape - x.par.solape)
  const cola = grupos.filter((g) => g.banda === 'cola')

  let corte = 0
  if (POR_EXPOSICION) {
    await anotarExposicion(c, gemelas)
    gemelas.sort((x, y) => y.expuesta - x.expuesta)
    corte = corteAcumulado(gemelas.map((g) => g.expuesta), 0.8)
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(gemelas.slice(0, LIMITE || gemelas.length).map((g) => ({
      art: g.art, expuesta: g.expuesta ?? null, copiasServidas: g.copiasServidas ?? null,
      ordenDistinto: g.ordenDistinto,
      solape: Number(g.par.solape.toFixed(3)), distintas: g.par.distintas,
      miembros: g.miembros.map((m) => ({ id: m.id, veces: m.veces ?? null, oficial: m.oficial,
                                         estado: m.estado, expl: m.expl, alta: m.alta,
                                         correcta: m.textoCorrecta,
                                         texto: String(m.texto).replace(/\s+/g, ' ').trim() })),
    })), null, 1))
    return
  }

  console.log('\n═══ CANDIDATOS PARAFRASEADOS · LEGISLATIVAS (solo listado) ═══')
  console.log(`  grupos examinados: ${rows.length}`)
  console.log(`  🟥 GEMELAS (mismo artículo y opciones, enunciado casi calcado, misma respuesta): ${gemelas.length}`)
  console.log(`     preguntas implicadas: ${gemelas.reduce((a, g) => a + g.n, 0)} · sobrantes si se confirman: ${gemelas.reduce((a, g) => a + g.n - 1, 0)}`)
  console.log(`  ⬜ cola de revisión (parecidas, NO concluyentes): ${cola.length}`)
  console.log('')
  console.log('  ⚠️ Ni la banda alta autoriza a jubilar en automático: un intercambio de UNA palabra')
  console.log('     de contenido («prevención secundaria»/«terciaria») hace otra pregunta y pasa el')
  console.log('     umbral. Se adjudica a mano, de una en una. Ver T-425.')
  const ordDist = gemelas.filter((g) => g.ordenDistinto).length
  if (ordDist) console.log(`  ⚠️ ${ordDist} llevan ORDEN: mismas palabras en distinta secuencia — ahí vive «¿cuántos\n     dictámenes?»/«¿cuántos informes?». Léelas enteras antes de decidir (T-439).`)
  if (POR_EXPOSICION) {
    const sinServir = gemelas.filter((g) => g.expuesta === 0).length
    const ambas = gemelas.filter((g) => g.copiasServidas >= 2).length
    console.log('')
    console.log(`  📊 EXPOSICIÓN — el recuento y el daño no se reparten igual:`)
    console.log(`     nunca servidos: ${sinServir}  ·  con ambas copias servidas: ${ambas}  ·  total: ${gemelas.reduce((a, g) => a + g.expuesta, 0).toLocaleString('es')} veces`)
    console.log(`     ▶ el 80% de la exposición cabe en los ${corte} primeros — empieza por ahí.`)
  }
  console.log('')
  for (const g of gemelas.slice(0, LIMITE || 40)) {
    const exp = POR_EXPOSICION ? ` expuesta=${g.expuesta}${g.copiasServidas >= 2 ? ' [AMBAS servidas]' : ''}` : ''
    const ord = g.ordenDistinto ? ' ⚠️ORDEN' : ''
    console.log(`\n  · solape=${g.par.solape.toFixed(3)} distintas=${g.par.distintas} n=${g.n}${exp}${ord}${g.miembros.some((m) => m.oficial) ? ' [hay OFICIAL en el grupo]' : ''}`)
    console.log(`      ${String(g.par.a.id).slice(0, 8)}: ${String(g.par.a.texto).replace(/\s+/g, ' ').slice(0, 150)}`)
    console.log(`      ${String(g.par.b.id).slice(0, 8)}: ${String(g.par.b.texto).replace(/\s+/g, ' ').slice(0, 150)}`)
  }
  if (gemelas.length > (LIMITE || 40)) console.log(`\n  … y ${gemelas.length - (LIMITE || 40)} más (usa --limite N)`)
  console.log('\n  (listado: no se ha tocado nada — se adjudica a mano, ver T-425)\n')
}

// ── Aplicar una adjudicación HECHA A MANO ────────────────────────────────────────────────
//
// El corte parafraseado NO puede jubilar solo (ver arriba: los falsos positivos sobreviven a
// cualquier umbral). Pero la adjudicación humana tiene que poder escribir por algún sitio, y ese
// sitio es ESTE, no un script nuevo: `lifecycle_state` es un recurso con trinquete de escritores
// y dos puertas al mismo recurso con criterios distintos no protegen, se contradicen.
//
// El fichero es una lista de decisiones explícitas — nada se deduce aquí:
//   [{ "quedaId": "<uuid>", "jubilar": [{"id":"<uuid>","estado":"approved"}], "motivo": "…" }]
//
// Se rehúsa jubilar una pregunta de examen OFICIAL: en este barrido no se toca ninguna, porque
// borrar de forma TERMINAL el registro de que algo cayó en un examen real necesita más que un
// parecido de texto.
async function aplicarAdjudicados(c, ruta) {
  const plan = JSON.parse(require('fs').readFileSync(ruta, 'utf8'))
  const ids = plan.flatMap((p) => p.jubilar.map((j) => j.id))
  const { rows: info } = await c.query(
    'select id, is_official_exam, lifecycle_state from questions where id = any($1::uuid[])', [ids])
  const porId = new Map(info.map((r) => [r.id, r]))

  const problemas = []
  for (const p of plan) for (const j of p.jubilar) {
    const r = porId.get(j.id)
    if (!r) problemas.push(`${j.id.slice(0, 8)}: no existe`)
    else if (r.is_official_exam) problemas.push(`${j.id.slice(0, 8)}: es de examen OFICIAL`)
    else if (r.lifecycle_state !== j.estado) problemas.push(`${j.id.slice(0, 8)}: estado cambió (${j.estado} → ${r.lifecycle_state})`)
  }
  console.log(`\n═══ ADJUDICACIÓN MANUAL · ${plan.length} grupo(s), ${ids.length} a jubilar ═══`)
  if (problemas.length) {
    console.log(`\n❌ ${problemas.length} problema(s) — no se aplica nada:`)
    problemas.slice(0, 20).forEach((x) => console.log(`   · ${x}`))
    process.exitCode = 1
    return
  }
  if (!APLICAR) {
    console.log('\n  (simulación: todo verificado, añade --aplicar para jubilar)\n')
    return
  }
  const { rows: adm } = await c.query("select id from user_profiles where email='manueltrader@gmail.com'")
  let ok = 0, fallos = 0
  for (const p of plan) for (const j of p.jubilar) {
    try {
      await c.query('select public.transition_question_state($1,$2,$3,$4,$5,null,$6)', [
        j.id, j.estado, 'retired_duplicate', 'admin_duplicate_of', adm[0].id,
        `Duplicado de ${p.quedaId}. ${p.motivo} Adjudicado a mano, uno a uno (T-439).`,
      ])
      ok++
    } catch (e) {
      fallos++
      console.log(`   ⚠️ ${String(j.id).slice(0, 8)}: ${e.message.slice(0, 110)}`)
    }
  }
  console.log(`\n  jubiladas: ${ok} · fallos: ${fallos}\n`)
}

async function main() {
  const c = new Client(pgConfig())
  await c.connect()
  try {
    if (ADJUDICADOS) {
      await aplicarAdjudicados(c, ADJUDICADOS)
      return
    }
    if (PARAFRASEADAS) {
      if (BANCO === 'legislativas' || BANCO === 'ambos') await listadoParafraseadasLegislativas(c)
      if (BANCO === 'psicotecnicas' || BANCO === 'ambos') await listadoParafraseadas(c)
      return
    }
    if (BANCO === 'legislativas' || BANCO === 'ambos') await barridoLegislativas(c)
    if (BANCO === 'psicotecnicas' || BANCO === 'ambos') await barridoPsicotecnicas(c)
  } finally {
    await c.end()
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
