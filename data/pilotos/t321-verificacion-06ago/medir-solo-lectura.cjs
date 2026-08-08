#!/usr/bin/env node
// medir-solo-lectura.cjs — reproduce SOLO LECTURA (VENCE_LECTOR_URL) lo que mide
// `scripts/calidad/duplicados-exactos.cjs` (banco legislativas), para quien no tenga la
// credencial de escritura (vence_coordinacion no puede leer `questions`: comprobado el
// 06/08/2026, "permission denied"). Reproduce la MISMA query SQL_GRUPOS y la MISMA guarda
// del mínimo (4 preguntas activas por artículo) del script original — no reinventa el
// criterio, solo lo mide sin escribir. [T-321]
//
// Uso: node data/pilotos/t321-verificacion-06ago/medir-solo-lectura.cjs
const path = require('path')
const ROOT = path.resolve(__dirname, '../../..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') })
const postgres = require(path.join(ROOT, 'node_modules/postgres'))

// Misma prioridad que decidirSuperviviente() de lib/calidad/duplicados.js: oficial → con
// explicación → más servida → más antigua. Aquí `servida` no se mide (requeriría
// test_questions, bloqueado por RLS para vence_lector) — no cambia el CONTEO de sobrantes,
// solo cuál sobrevive dentro de cada grupo, así que es seguro para esta medición.
function decidir(miembros) {
  const orden = [...miembros].sort((a, b) => {
    if (!!a.oficial !== !!b.oficial) return a.oficial ? -1 : 1
    if ((a.expl > 0) !== (b.expl > 0)) return a.expl > 0 ? -1 : 1
    return new Date(a.alta) - new Date(b.alta)
  })
  return [orden[0], orden.slice(1)]
}

async function main() {
  const sql = postgres(process.env.VENCE_LECTOR_URL + '?sslmode=require', { ssl: { rejectUnauthorized: false }, max: 2 })
  const rows = await sql`
    with base as (
      select q.id, q.question_text, q.correct_option, q.created_at, q.is_official_exam,
             q.explanation, q.primary_article_id, q.lifecycle_state,
             lower(regexp_replace(q.question_text, '\s+', ' ', 'g')) as norm,
             (select string_agg(x, '|' order by x) from unnest(array[
                lower(trim(q.option_a)), lower(trim(q.option_b)),
                lower(trim(q.option_c)), lower(trim(q.option_d))]) x) as ops
        from questions q
       where q.is_active
         and q.primary_article_id is not null
         and q.exam_case_id is null
    )
    select norm, primary_article_id, ops, count(*)::int n,
           json_agg(json_build_object(
             'id', id, 'oficial', is_official_exam,
             'expl', coalesce(length(explanation), 0), 'alta', created_at
           ) order by created_at) as miembros
      from base
     group by 1, 2, 3
    having count(*) > 1`

  const porArticulo = new Map()
  let jubilarTotal = 0
  for (const g of rows) {
    const [, fuera] = decidir(g.miembros)
    jubilarTotal += fuera.length
    porArticulo.set(g.primary_article_id, (porArticulo.get(g.primary_article_id) || 0) + fuera.length)
  }
  const aids = [...porArticulo.keys()]
  const totales = aids.length
    ? await sql`select primary_article_id aid, count(*)::int total from questions where is_active and primary_article_id = any(${aids}) group by 1`
    : []
  const totalPorArt = new Map(totales.map((r) => [r.aid, r.total]))
  const MINIMO = 4
  let protegidas = 0
  const articulosProtegidos = new Set()
  for (const [aid, quita] of porArticulo) {
    if ((totalPorArt.get(aid) || 0) - quita < MINIMO) {
      protegidas += quita
      articulosProtegidos.add(aid)
    }
  }

  console.log(`grupos duplicado exacto: ${rows.length}`)
  console.log(`preguntas sobrantes: ${jubilarTotal}`)
  console.log(`protegidas por el mínimo de ${MINIMO}/artículo: ${protegidas} (${articulosProtegidos.size} artículos)`)
  console.log(`accionables hoy (fuera de la guarda): ${jubilarTotal - protegidas}`)
  console.log('\n(solo lectura — para aplicar hace falta node scripts/calidad/duplicados-exactos.cjs --aplicar con DATABASE_URL de escritura)')

  await sql.end()
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
