#!/usr/bin/env node
/**
 * Planificador de la campaña de artículos huérfanos (T-115, `article_no_coverage`).
 * Alimenta el núcleo puro `lib/generacion/huerfanosPlan.js` con los datos de RDS.
 *
 *   node scripts/huerfanos-plan.cjs                        # estado + siguiente lote propuesto
 *   node scripts/huerfanos-plan.cjs --ley lprl             # huérfanos de una ley, por alcance
 *   node scripts/huerfanos-plan.cjs --simula lprl 10 11 12 # impacto ANTES de escribir nada
 *   node scripts/huerfanos-plan.cjs --deuda                # deuda REAL (incluye lo que el badge ya no ve)
 *   node scripts/huerfanos-plan.cjs --excluir lprl,ley-7-1985   # para sesiones en paralelo
 *
 * La consulta reproduce el universo del detector (artículos escopados, activos,
 * con contenido real y no derogados); el juicio de qué dispara y qué conviene
 * hacer vive en el núcleo puro, que está testeado y en paridad con el sweep.
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
const plan = require(path.join(__dirname, '..', 'lib', 'generacion', 'huerfanosPlan'))

const argv = process.argv.slice(2)
const flag = (n) => argv.indexOf(n)
const valor = (n) => (flag(n) >= 0 ? argv[flag(n) + 1] : null)

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

const SQL = `
  SELECT tp.position_type   AS pt,
         tp.id::text        AS "topicId",
         tp.topic_number    AS tema,
         l.slug             AS "leySlug",
         l.short_name       AS ley,
         a.article_number   AS articulo,
         EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active) AS cubierto
  FROM topic_scope ts
  JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
  JOIN laws l ON l.id = ts.law_id
  JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
  JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num AND a.is_active
  WHERE length(coalesce(a.content, '')) > 40
    AND a.content NOT ILIKE '%derogado%'
    AND a.article_number ~ '^[0-9]+$'`

const tabla = (filas) => { console.table(filas); return filas }

;(async () => {
  const filas = await s.unsafe(SQL)

  // --simula <ley_slug> <art…>
  if (flag('--simula') >= 0) {
    const [leySlug, ...arts] = argv.slice(flag('--simula') + 1)
    if (!leySlug || !arts.length) throw new Error('uso: --simula <ley_slug> <art> [<art>…]')
    const imp = plan.simulaCobertura(filas, arts.map((articulo) => ({ leySlug, articulo })))
    console.log(`\nSimulación — cubrir ${leySlug} arts ${arts.join(', ')}:\n`)
    console.log(`  temas que disparan:  ${imp.temasAntes} → ${imp.temasDespues}  (${imp.temasAntes - imp.temasDespues} apagados)`)
    console.log(`  oposiciones:         ${imp.oposicionesAntes} → ${imp.oposicionesDespues}`)
    if (imp.oposicionesLimpias.length) console.log(`  quedan SIN finding:  ${imp.oposicionesLimpias.join(', ')}`)
    if (imp.temasApagados.length) tabla(imp.temasApagados.slice(0, 25))
    if (imp.huerfanosResidualesEnTemasApagados.length) {
      console.log(`\n  ⚠️ el finding se apaga pero quedan ${imp.huerfanosResidualesEnTemasApagados.length} artículo(s) sirviendo 0 preguntas`)
      console.log(`     en esos mismos temas: ${imp.huerfanosResidualesEnTemasApagados.slice(0, 20).join(', ')}`)
      console.log('     (el badge a cero NO es temario cubierto — apúntalos para una segunda vuelta)')
    }
    await s.end()
    return
  }

  // --ley <slug> · --deuda
  const soloQueDisparan = flag('--deuda') < 0
  const ley = valor('--ley')
  if (ley || flag('--deuda') >= 0) {
    const r = plan.rankingHuerfanos(filas, { soloQueDisparan }).filter((a) => !ley || a.leySlug === ley)
    console.log(`\n${r.length} artículo(s) huérfano(s)${ley ? ` en ${ley}` : ''}${soloQueDisparan ? ' en temas que disparan el finding' : ' (DEUDA REAL, incluye lo que el badge ya no ve)'}:\n`)
    tabla(r.slice(0, 40).map((a) => ({ ley: a.ley, art: a.articulo, oposiciones: a.nOposiciones, temas: a.nTemas })))
    await s.end()
    return
  }

  // Estado global + siguiente lote
  const disparan = plan.temasQueDisparan(filas)
  const ranking = plan.rankingHuerfanos(filas)
  const deuda = plan.rankingHuerfanos(filas, { soloQueDisparan: false })
  console.log('\n=== CAMPAÑA article_no_coverage (T-115) ===\n')
  console.log(`  temas que disparan el finding: ${disparan.length}`)
  console.log(`  oposiciones afectadas:         ${new Set(disparan.map((t) => t.pt)).size}`)
  console.log(`  artículos huérfanos distintos: ${ranking.length}  ·  deuda real (incl. invisibles): ${deuda.length}`)

  const porLey = {}
  for (const a of ranking) porLey[a.ley] = (porLey[a.ley] || 0) + 1
  console.log('\nLeyes con más huérfanos:')
  tabla(Object.entries(porLey).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ley, arts]) => ({ ley, arts })))

  const excluir = (valor('--excluir') || '').split(',').filter(Boolean)
  const lote = plan.proponeLote(filas, { maxArticulos: Number(valor('--max') || 6), excluirLeyes: excluir })
  if (!lote) { console.log('\n✅ no queda ningún hueco que mueva el badge'); await s.end(); return }

  console.log(`\n▶ SIGUIENTE LOTE PROPUESTO — ${lote.ley} (${lote.leySlug})`)
  tabla(lote.articulos.map((a) => ({ art: a.articulo, oposiciones: a.nOposiciones, temas: a.nTemas })))
  console.log(`  impacto: ${lote.impacto.temasAntes} → ${lote.impacto.temasDespues} temas (${lote.impacto.temasApagados.length} apagados)`)
  if (lote.impacto.oposicionesLimpias.length) console.log(`  quedan SIN finding: ${lote.impacto.oposicionesLimpias.join(', ')}`)
  console.log(`\n  1) node scripts/verificar-articulos-vs-boe.cjs ${lote.leySlug} <BOE-ID> ${lote.articulos.map((a) => a.articulo).join(' ')}`)
  console.log('  2) generar el borrador (manual generar-preguntas-con-ia.md) → insertar → verificar → doble auditoría ciega → aprobar → Paso 9')

  await s.end()
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
