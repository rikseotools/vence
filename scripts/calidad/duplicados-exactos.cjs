#!/usr/bin/env node
// scripts/calidad/duplicados-exactos.cjs
//
// Duplicados EXACTOS del banco de preguntas: simula primero, jubila después. [T-321]
//
//   node scripts/calidad/duplicados-exactos.cjs                      # simula TODO el banco
//   node scripts/calidad/duplicados-exactos.cjs --dia 2026-03-21     # solo el lote de ese día
//   node scripts/calidad/duplicados-exactos.cjs --dia 2026-03-21 --aplicar
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

const argv = process.argv.slice(2)
const valor = (f) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}
const DIA = valor('--dia')
const APLICAR = argv.includes('--aplicar')
const LIMITE = parseInt(valor('--limite') || '0', 10)

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

/** Devuelve [superviviente, ...aJubilar] con el orden de prioridad del encabezado. */
function decidir(miembros) {
  const orden = [...miembros].sort((a, b) => {
    if (a.oficial !== b.oficial) return a.oficial ? -1 : 1
    if ((a.expl > 0) !== (b.expl > 0)) return a.expl > 0 ? -1 : 1
    if (a.servida !== b.servida) return b.servida - a.servida
    return new Date(a.alta) - new Date(b.alta)
  })
  return [orden[0], orden.slice(1)]
}

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.split('?')[0],
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

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
    await c.end()
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
  await c.end()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
