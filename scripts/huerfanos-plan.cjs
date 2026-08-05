#!/usr/bin/env node
/**
 * Planificador de la campaña de artículos huérfanos (T-115, `article_no_coverage`).
 * Alimenta el núcleo puro `lib/generacion/huerfanosPlan.js` con los datos de RDS.
 *
 *   node scripts/huerfanos-plan.cjs                        # estado + siguiente lote propuesto
 *   node scripts/huerfanos-plan.cjs --ley lprl             # huérfanos de una ley, por alcance
 *   node scripts/huerfanos-plan.cjs --simula lprl 10 11 12 # impacto ANTES de escribir nada
 *   node scripts/huerfanos-plan.cjs --deuda                # deuda REAL (incluye lo que el badge ya no ve)
 *   node scripts/huerfanos-plan.cjs --oposicion auxiliar-administrativo-estado   # cerrar UNA oposición
 *   node scripts/huerfanos-plan.cjs --invisibles            # deuda que el badge NO puede ver (T-146)
 *   node scripts/huerfanos-plan.cjs --invisibles adicional  # y por familia
 *   node scripts/huerfanos-plan.cjs --excluir lprl,ley-7-1985   # para sesiones en paralelo
 *
 * La consulta reproduce el universo del detector (artículos escopados, activos,
 * con contenido real y no derogados); el juicio de qué dispara y qué conviene
 * hacer vive en el núcleo puro, que está testeado y en paridad con el sweep.
 *
 * ⚠️ `--oposicion` enseña la DEUDA COMPLETA de esa oposición, no solo lo que dispara el
 * badge (T-543): pregunta "qué le falta a ESTE tema", así que un hueco de la banda ciega
 * (huecos reales que ningún finding dispara) también sale. `--deuda` sigue existiendo
 * para pedir la deuda completa SIN acotar a una oposición.
 */
const fs = require('fs')
const path = require('path')
const pg = require('postgres')
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
         length(a.content)  AS len,
         -- El detector filtra por entero puro, así que los NO numerados le son
         -- invisibles (T-146). Aquí se traen igual pero MARCADOS: el núcleo puro los
         -- excluye del veredicto del finding (fidelidad del espejo) y los incluye en
         -- la vista de deuda. Filtrarlos en el SQL era justo lo que escondía 715
         -- artículos sirviendo cero preguntas.
         (a.article_number ~ '^[0-9]+$') AS numerado,
         -- Artículo con NOTA DE VIGENCIA (inciso anulado por el TC, remisión a preceptos
         -- nulos…). El planificador lo ignoraba y seguía proponiéndolo: el 26/07/2026 el
         -- art. 87 ter de la LJCA salía el primero del ranking justo después de marcarlo
         -- como NO generable, una trampa para la siguiente sesión. Se marca, no se oculta:
         -- la nota puede ser informativa y el juicio es de quien genera.
         (a.vigencia_notes IS NOT NULL) AS "conNotaVigencia",
         EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active) AS cubierto
  FROM topic_scope ts
  JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
  JOIN laws l ON l.id = ts.law_id
  -- article_numbers = NULL significa LA LEY ENTERA (convención del proyecto), y el
  -- unnest de antes lo trataba como «ningún artículo»: unnest(NULL) no devuelve filas,
  -- así que el scope entero desaparecía del análisis. Mismo patrón que ya mordió en
  -- articleInScope() con x = ANY(NULL) → NULL.
  --
  -- Una ley seguía siendo visible si ALGÚN OTRO tema la escopaba con lista (por eso
  -- TFUE salía con 244 huecos). Las que se perdían del todo eran las que solo tienen
  -- scopes NULL: 184 leyes y 4.865 artículos con texto y sin una sola pregunta, frente a
  -- los 10.200 que el planificador sí reportaba. Y esta herramienta es justo por donde
  -- CLAUDE.md manda empezar antes de escribir una pregunta. Medido el 01/08 (T-451).
  JOIN articles a
    ON a.law_id = ts.law_id
   AND a.is_active
   AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
  WHERE length(coalesce(a.content, '')) > 40
    AND a.content NOT ILIKE '%derogado%'`

const tabla = (filas) => { console.table(filas); return filas }

;(async () => {
  const filas = await s.unsafe(SQL)

  // Demanda real por oposición: el alcance dice en cuántos sitios sale el hueco,
  // no a cuánta gente llega, y no es lo mismo (26/07: dos leyes con idéntico
  // rendimiento por artículo, 3.130 vs 733 opositores detrás).
  const demRows = await s.unsafe(
    `SELECT target_oposicion AS pt, count(*)::int usuarios FROM user_profiles WHERE target_oposicion IS NOT NULL GROUP BY 1`,
  )
  const demanda = Object.fromEntries(demRows.map((d) => [d.pt, d.usuarios]))

  // Leyes con batch generado en las últimas 24h por CUALQUIER sesión. Nace de la
  // colisión del 26/07: dos sesiones sobre los mismos 5 artículos de la LPRL con
  // 13 minutos de diferencia. `--excluir` ya existía, pero exige saber de antemano
  // qué excluir; esto lo detecta solo.
  const enCursoRows = await s.unsafe(
    `SELECT DISTINCT l.slug AS ley FROM questions q
       JOIN articles a ON a.id = q.primary_article_id
       JOIN laws l ON l.id = a.law_id
       JOIN LATERAL unnest(q.tags) AS t(tag) ON t.tag LIKE 'gen\\_%'
      WHERE q.created_at > now() - interval '24 hours'`,
  )
  const enCurso = new Set(enCursoRows.map((r) => r.ley))
  const avisoEnCurso = () => {
    if (!enCurso.size) return
    console.log(`\n  ⚠️ leyes con batch en las últimas 24h (otra sesión): ${[...enCurso].join(', ')}`)
    console.log('     Generar sobre una de ellas duplica trabajo: el dedup del Paso 3 compara ENUNCIADOS')
    console.log('     y no caza dos preguntas que evalúan lo mismo con otras palabras.')
  }

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

  // --invisibles [tipo] — la deuda que el badge NO puede ver (T-146)
  if (flag('--invisibles') >= 0) {
    const tipoPedido = argv[flag('--invisibles') + 1]
    const tipos = tipoPedido && !tipoPedido.startsWith('--') ? [tipoPedido] : null
    const todos = plan.rankingHuerfanos(filas, { soloQueDisparan: false, demanda, incluirNoNumerados: true })
    const noVistos = todos.filter((a) => !plan.naturalezaArticulo(a.articulo).numerado)
    const porTipo = {}
    for (const a of noVistos) porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1
    console.log('\n=== DEUDA INVISIBLE AL BADGE (T-146) ===\n')
    console.log(`  ${noVistos.length} artículo(s) escopados, activos, con texto y 0 preguntas, que el detector NO cuenta`)
    console.log('  (filtra `article_number ~ \'^[0-9]+$\'`, así que bis/ter y disposiciones no existen para él)\n')
    tabla(Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, n]) => ({ tipo, huecos: n })))
    const foco = tipos ? noVistos.filter((a) => tipos.includes(a.tipo)) : noVistos.filter((a) => a.tipo === 'reforma')
    console.log(`\n▶ ${tipos ? tipos[0] : 'reforma'} — por alcance (es la familia examinable: Derecho introducido por modificación):\n`)
    tabla(plan.marcaEnCurso(foco, enCurso).slice(0, 25).map((a) => ({
      ley: a.ley, art: a.articulo, oposiciones: a.nOposiciones, temas: a.nTemas, usuarios: a.usuarios, enCurso: a.enCurso ? '⚠️' : '', vigencia: a.conNotaVigencia ? '🚫 nota' : '',
    })))
    console.log('\n  Las disposiciones (adicional/transitoria/final/derogatoria) NO se proponen en bloque:')
    console.log('  una disposición final de entrada en vigor no es materia de examen. Se miran caso por caso')
    console.log('  con `--invisibles adicional`, que es donde hay alguna examinable (p. ej. la DT 3ª del EBEP).')
    avisoEnCurso()
    await s.end()
    return
  }

  // --ley <slug> · --deuda · --oposicion <slug>
  // Acepta el slug con guiones (como en la URL) o el position_type con guiones bajos.
  const opoArg = valor('--oposicion')
  const oposicion = opoArg ? opoArg.replace(/-/g, '_') : null
  // `--oposicion` implica DEUDA COMPLETA por defecto (T-543): pregunta "qué le falta a
  // ESTE tema", no "qué mueve el badge global" — un tema de la banda ciega (huecos
  // reales que no disparan ningún finding) salía invisible si no se pedía --deuda a la vez.
  const soloQueDisparan = !plan.usarDeudaCompleta({ deudaPedida: flag('--deuda') >= 0, oposicion })
  if (ley || oposicion || flag('--deuda') >= 0) {
    const r = plan
      .marcaEnCurso(plan.rankingHuerfanos(filas, { soloQueDisparan, demanda, oposicion }), enCurso)
      .filter((a) => !ley || a.leySlug === ley)
    if (oposicion) {
      const suyos = plan.temasQueDisparan(filas).filter((t) => t.pt === oposicion)
      console.log(`\n${oposicion}: ${suyos.length} tema(s) disparando · ${demanda[opoArg] || demanda[oposicion] || 0} usuarios`)
      console.log('  (cerrarla del todo = cubrir TODOS estos artículos; el alcance y los usuarios son globales)')
    }
    console.log(`\n${r.length} artículo(s) huérfano(s)${ley ? ` en ${ley}` : ''}${oposicion ? ` de ${oposicion}` : ''}${soloQueDisparan ? ' en temas que disparan el finding' : ' (DEUDA REAL, incluye lo que el badge ya no ve)'}:\n`)
    tabla(r.slice(0, 40).map((a) => ({ ley: a.ley, art: a.articulo, oposiciones: a.nOposiciones, temas: a.nTemas, usuarios: a.usuarios, enCurso: a.enCurso ? '⚠️' : '' })))
    await s.end()
    return
  }

  // Estado global + siguiente lote
  const disparan = plan.temasQueDisparan(filas)
  const ranking = plan.marcaEnCurso(plan.rankingHuerfanos(filas, { demanda }), enCurso)
  const deuda = plan.rankingHuerfanos(filas, { soloQueDisparan: false })
  console.log('\n=== CAMPAÑA article_no_coverage (T-115) ===\n')
  console.log(`  temas que disparan el finding: ${disparan.length}   ⚠️ NO es una métrica de progreso (ver abajo)`)
  console.log(`  oposiciones afectadas:         ${new Set(disparan.map((t) => t.pt)).size}`)
  console.log(`  artículos huérfanos distintos: ${ranking.length}  ·  deuda real (incl. invisibles): ${deuda.length}`)
  // El contador de TEMAS puede SUBIR al cubrir artículos, y no es un fallo: el detector solo
  // cuenta el tema si su cobertura llega al 60% (por debajo es `low_coverage`, otro cubo). Cubrir
  // artículos de un tema mal cubierto lo EMPUJA por encima de ese corte, y si aún le quedan ≥4
  // huecos entra en este contador. Medido el 31/07/2026 con 31 preguntas sobre 10 artículos:
  // 353 → 358 temas (8 entraron, todos cruzando el 60% desde el 48-58%; 3 salieron), mientras
  // los ARTÍCULOS huérfanos bajaban 3.540 → 3.530, exactamente los 10 cubiertos.
  // Quien mida la campaña por el número de temas concluirá que el trabajo no sirve.
  console.log(
    '\n  ⚠️ Para medir progreso mira los ARTÍCULOS huérfanos, que solo bajan. El contador de TEMAS\n' +
    '     puede subir al cubrir: el detector exige ≥60% de cobertura para contar un tema, así que\n' +
    '     mejorar un tema mal cubierto lo hace CRUZAR ese corte y entrar aquí desde `low_coverage`.',
  )

  // Por ley: nº de huérfanos, a cuánta gente llegan y si otra sesión la está
  // trabajando. Las tres cosas juntas son las que evitan elegir mal.
  const porLey = {}
  for (const a of ranking) {
    const e = (porLey[a.ley] = porLey[a.ley] || { arts: 0, usuarios: 0, slug: a.leySlug, enCurso: a.enCurso })
    e.arts++
    e.usuarios = Math.max(e.usuarios, a.usuarios)
  }
  console.log('\nLeyes con más huérfanos (usuarios = alcance real del artículo más transversal):')
  tabla(
    Object.entries(porLey)
      .sort((a, b) => b[1].arts - a[1].arts)
      .slice(0, 10)
      .map(([ley, e]) => ({ ley, arts: e.arts, usuarios: e.usuarios, enCurso: e.enCurso ? '⚠️ otra sesión' : '' })),
  )

  const excluir = (valor('--excluir') || '').split(',').filter(Boolean)
  const lote = plan.proponeLote(filas, { maxArticulos: Number(valor('--max') || 6), excluirLeyes: excluir })
  if (!lote) { console.log('\n✅ no queda ningún hueco que mueva el badge'); await s.end(); return }

  console.log(`\n▶ SIGUIENTE LOTE PROPUESTO — ${lote.ley} (${lote.leySlug})`)
  tabla(lote.articulos.map((a) => ({ art: a.articulo, oposiciones: a.nOposiciones, temas: a.nTemas })))
  console.log(`  impacto: ${lote.impacto.temasAntes} → ${lote.impacto.temasDespues} temas (${lote.impacto.temasApagados.length} apagados)`)
  if (lote.impacto.oposicionesLimpias.length) console.log(`  quedan SIN finding: ${lote.impacto.oposicionesLimpias.join(', ')}`)
  console.log(`\n  1) node scripts/verificar-articulos-vs-boe.cjs ${lote.leySlug} <BOE-ID> ${lote.articulos.map((a) => a.articulo).join(' ')}`)
  console.log('  2) generar el borrador (manual generar-preguntas-con-ia.md) → insertar → verificar → doble auditoría ciega → aprobar → Paso 9')
  if (enCurso.has(lote.leySlug)) {
    console.log(`\n  ⚠️ OJO: ${lote.leySlug} YA tiene un batch de las últimas 24h — comprueba qué artículos cubrió antes de escribir.`)
  }
  avisoEnCurso()

  await s.end()
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
