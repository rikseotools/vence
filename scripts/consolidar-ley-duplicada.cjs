#!/usr/bin/env node
/**
 * Consolida DOS filas de `laws` que son la MISMA norma (T-127).
 *
 * EL PROBLEMA
 * -----------
 * Hay 18 grupos de leyes duplicadas por id del BOE, y en 6 de ellos AMBAS filas
 * tienen temas escopados. Como la pregunta cuelga del `article_id`, las preguntas
 * de una fila **no se sirven** en los temas escopados a la otra: el banco queda
 * partido en dos mitades que no se ven, y todo lo que se haga sobre esa norma
 * (generar, verificar completitud, incisos anulados, monitoreo BOE) cuesta el
 * doble. Caso origen: la LPRL, con 1.083 preguntas en una fila y 56 en la otra.
 *
 * QUÉ HACE — y qué NO
 * -------------------
 * Mueve lo que SIRVE contenido, y nada más:
 *   1. `questions.primary_article_id` y `question_articles.article_id` de los
 *      artículos de la fila muerta a los de la superviviente, emparejando por
 *      NÚMERO de artículo.
 *   2. `topic_scope.law_id` de la fila muerta a la superviviente (uniendo los
 *      `article_numbers` si el tema ya escopaba a la superviviente).
 *
 * **No borra nada.** Los artículos de la fila muerta se quedan donde están, y
 * las tablas históricas y de analítica (`test_questions`, `user_progress`,
 * `ai_verification_results`…) siguen apuntando a ellos a propósito: son el
 * registro de lo que pasó, no lo que se sirve. Repuntarlas sería reescribir
 * historia para nada.
 *
 * CAPAS DE SEGURIDAD (todas ANTES de tocar una fila)
 * -------------------------------------------------
 *   · Verifica que ambas filas son la misma norma por **id del BOE**. Sin eso,
 *     un slug parecido bastaría para fusionar dos leyes distintas.
 *   · Aborta si algún artículo con preguntas o escopado **no existe** en la
 *     superviviente: dejarlo pasaría preguntas a la nada.
 *   · Compara el TEXTO artículo por artículo. Una diferencia de más del 2% exige
 *     `--acepta-diferencias` explícito: mover una pregunta a un texto distinto
 *     puede invalidar su clave, y eso no se decide por descuido.
 *   · Sin `--apply` es una SIMULACIÓN: enseña el antes/después de preguntas
 *     servidas por tema y no escribe nada.
 *   · Con `--apply` va todo en UNA transacción y vuelve a contar al final.
 *
 * Uso:
 *   node scripts/consolidar-ley-duplicada.cjs <slug-muerta> <slug-superviviente>
 *   node scripts/consolidar-ley-duplicada.cjs <muerta> <viva> --apply [--acepta-diferencias]
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
const { emparejarArticulos } = require(path.join(__dirname, '..', 'lib', 'salud', 'emparejarArticulos'))

const [SLUG_MUERTA, SLUG_VIVA] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const APPLY = process.argv.includes('--apply')
const ACEPTA_DIF = process.argv.includes('--acepta-diferencias')

if (!SLUG_MUERTA || !SLUG_VIVA) {
  console.error('uso: node scripts/consolidar-ley-duplicada.cjs <slug-muerta> <slug-superviviente> [--apply] [--acepta-diferencias]')
  process.exit(1)
}

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url.replace(/sslmode=[^&]*/, 'sslmode=no-verify'), {
  ssl: { rejectUnauthorized: false },
  max: 1,
  connect_timeout: 60,
  idle_timeout: 180,
})

const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase()
const boeId = (u) => (String(u || '').match(/BOE-A-\d{4}-\d+/) || [null])[0]
const abortar = async (msg) => {
  console.error('\n❌ ABORTADO — ' + msg)
  await s.end()
  process.exit(2)
}

;(async () => {
  const [muerta] = await s`SELECT id, short_name, slug, boe_url FROM laws WHERE slug=${SLUG_MUERTA}`
  const [viva] = await s`SELECT id, short_name, slug, boe_url FROM laws WHERE slug=${SLUG_VIVA}`
  if (!muerta) await abortar(`no existe la ley con slug "${SLUG_MUERTA}"`)
  if (!viva) await abortar(`no existe la ley con slug "${SLUG_VIVA}"`)
  if (muerta.id === viva.id) await abortar('la fila muerta y la superviviente son la misma')

  // Capa 1 — misma norma, probado por el id del BOE.
  const bM = boeId(muerta.boe_url)
  const bV = boeId(viva.boe_url)
  if (!bM || !bV || bM !== bV) {
    await abortar(
      `no se puede probar que sean la MISMA norma: BOE de la muerta = ${bM || '(sin id)'} · BOE de la viva = ${bV || '(sin id)'}. ` +
        'Consolidar dos normas distintas destruiría contenido.',
    )
  }
  console.log(`Consolidando "${muerta.short_name}" (${muerta.slug}) → "${viva.short_name}" (${viva.slug})`)
  console.log(`Misma norma verificada por id del BOE: ${bM}\n`)

  // Emparejamiento por número de artículo.
  const artsM = await s`
    SELECT a.id, a.article_number, a.content, a.is_active,
      (SELECT count(*)::int FROM questions q WHERE q.primary_article_id = a.id) preg_todas,
      (SELECT count(*)::int FROM questions q WHERE q.primary_article_id = a.id AND q.is_active) preg_activas
    FROM articles a WHERE a.law_id = ${muerta.id}`
  const artsV = await s`SELECT id, article_number, content FROM articles WHERE law_id = ${viva.id} AND is_active`

  // Emparejamiento por núcleo puro (`lib/salud/emparejarArticulos.js`): tolera
  // acentos/mayúsculas/espacios pero NO ordinales ni números, y se planta si hay
  // ambigüedad. Caso real: "37 quater" vs "37 quáter" son el mismo precepto y la
  // igualdad exacta abortaba la consolidación entera.
  const emp = emparejarArticulos(artsM, artsV)
  const porNum = new Map()
  for (const m of emp.mapeo) porNum.set(m.de.article_number, m.a)
  const noExactos = emp.mapeo.filter((m) => !m.exacto)
  if (noExactos.length) {
    console.log('Artículos emparejados TRAS NORMALIZAR (revísalos):')
    noExactos.forEach((m) => console.log(`   "${m.de.article_number}"  ↔  "${m.a.article_number}"`))
    console.log('')
  }
  if (emp.ambiguos.length) {
    console.error('Artículos AMBIGUOS (varias parejas posibles en la superviviente):')
    emp.ambiguos.forEach((x) =>
      console.error(`   "${x.articulo.article_number}" → ${x.candidatos.map((c) => `"${c.article_number}"`).join(', ')}`),
    )
    await abortar('hay artículos ambiguos: elegir por adivinación movería contenido al precepto equivocado')
  }

  // Números que los temas escopan de la fila muerta: también tienen que existir.
  const scope = await s`
    SELECT ts.id, ts.topic_id, ts.article_numbers, tp.position_type, tp.topic_number,
           (SELECT ts2.id FROM topic_scope ts2 WHERE ts2.topic_id = ts.topic_id AND ts2.law_id = ${viva.id}) ya_viva,
           (SELECT ts2.article_numbers FROM topic_scope ts2 WHERE ts2.topic_id = ts.topic_id AND ts2.law_id = ${viva.id}) nums_viva
    FROM topic_scope ts JOIN topics tp ON tp.id = ts.topic_id
    WHERE ts.law_id = ${muerta.id}`

  const sinPareja = []
  const diferencias = []
  const mapeo = []
  for (const a of artsM) {
    const v = porNum.get(a.article_number)
    const relevante = a.preg_todas > 0
    if (!v) {
      if (relevante) sinPareja.push(`art ${a.article_number} (${a.preg_todas} preguntas)`)
      continue
    }
    const nA = norm(a.content)
    const nV = norm(v.content)
    if (nA !== nV) {
      const dif = Math.abs(nA.length - nV.length) / Math.max(1, nV.length)
      if (relevante) diferencias.push({ num: a.article_number, preg: a.preg_todas, pct: dif })
    }
    if (relevante) mapeo.push({ de: a.id, a: v.id, num: a.article_number, preg: a.preg_todas, act: a.preg_activas })
  }
  const numsEscopados = new Set(scope.flatMap((x) => x.article_numbers || []))

  // Capa 2 — nada puede quedarse sin destino, pero "sin pareja" no siempre es un
  // error: puede ser un artículo que la OTRA importación no trajo (caso real: el
  // `preámbulo` del RDL 670/1987, que solo existe en la fila muerta y está
  // escopado). Abortar ahí obligaba a parchear a mano en producción. Lo correcto
  // es RE-PARENTARLO: la fila del artículo se mueve a la superviviente con su
  // contenido y sus referencias intactas. No se copia ni se inventa nada.
  const aReparentar = emp.soloEnMuerta.filter((a) => a.preg_todas > 0 || numsEscopados.has(a.article_number))
  const huerfanosDeVerdad = sinPareja.filter((t) => !aReparentar.some((a) => t.startsWith(`art ${a.article_number} `)))
  if (huerfanosDeVerdad.length) {
    console.error('artículos con preguntas y sin destino posible:', huerfanosDeVerdad.join(', '))
    await abortar('hay contenido que se quedaría sin artículo de destino')
  }
  if (aReparentar.length) {
    console.log('Artículos que solo existen en la fila muerta → se RE-PARENTAN a la superviviente:')
    aReparentar.forEach((a) =>
      console.log(`   "${a.article_number}" (${a.preg_todas} preguntas${numsEscopados.has(a.article_number) ? ', escopado' : ''})`),
    )
    console.log('')
  }

  // Números escopados que no existen como artículo en NINGUNA de las dos filas:
  // eso ya está roto hoy (kind `scope_phantom_article`) y consolidar no lo empeora,
  // así que se avisa sin bloquear — bloquear aquí solo escondería el problema real.
  const numsEnMuerta = new Set(artsM.map((a) => a.article_number))
  const fantasmas = [...numsEscopados].filter((n) => !porNum.has(n) && !numsEnMuerta.has(n))
  if (fantasmas.length) {
    console.log(`⚠️ números escopados que no existen en ninguna de las dos filas (ya rotos hoy): ${fantasmas.join(', ')}`)
    console.log('   → son `scope_phantom_article`, se arreglan aparte; consolidar no los empeora.\n')
  }

  // Capa 3 — diferencias de texto por encima del 2% exigen decisión explícita.
  const graves = diferencias.filter((d) => d.pct > 0.02)
  if (diferencias.length) {
    console.log('Artículos con preguntas cuyo texto NO es idéntico:')
    diferencias.forEach((d) =>
      console.log(`   art ${d.num}: ${d.preg} preguntas · diferencia ${(d.pct * 100).toFixed(1)}%${d.pct > 0.02 ? '  ⚠️ >2%' : ''}`),
    )
    console.log('   (revisa cuál de los dos textos es el vigente ANTES de mover preguntas)\n')
  }
  if (graves.length && !ACEPTA_DIF) {
    await abortar(
      `${graves.length} artículo(s) con preguntas difieren más de un 2%. Verifica contra el BOE y, si la superviviente es la vigente, repite con --acepta-diferencias.`,
    )
  }

  // Antes/después por tema (lo que de verdad ve el opositor).
  const servidas = async (topicId, lawId) => {
    const [r] = await s`
      SELECT count(DISTINCT q.id)::int n
      FROM topic_scope ts
      JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
      JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num AND a.is_active
      JOIN questions q ON q.primary_article_id = a.id AND q.is_active
      WHERE ts.topic_id = ${topicId} AND ts.law_id = ${lawId}`
    return r.n
  }

  console.log('IMPACTO POR TEMA (preguntas de esta norma servidas hoy → tras consolidar)')
  const antes = []
  for (const x of scope) {
    const hoy = await servidas(x.topic_id, muerta.id)
    const futuro = await servidas(x.topic_id, viva.id) // lo que aportaría la superviviente con SU scope actual
    antes.push({ ...x, hoy, futuro })
    console.log(
      `   ${x.position_type} T${x.topic_number}: ${hoy} → (con el mismo listado de artículos sobre la fila viva)` +
        `${x.ya_viva ? '  · el tema YA escopa la superviviente: se FUSIONAN los listados' : ''}`,
    )
  }

  // TRADUCCIÓN DE NOMENCLATURA EN EL SCOPE. Si "37 quater" se emparejó con
  // "37 quáter", mover el `topic_scope` tal cual dejaría el número apuntando a un
  // artículo que en la fila viva se llama de otra forma: se convertiría en
  // `scope_phantom_article` — un tema sirviendo 0 preguntas de ese artículo, en
  // silencio. Al mover el scope hay que reescribir los números a la nomenclatura
  // de la superviviente.
  const traduce = new Map(emp.mapeo.filter((m) => !m.exacto).map((m) => [m.de.article_number, m.a.article_number]))
  const traducir = (nums) => (nums ? nums.map((n) => traduce.get(n) || n) : nums)
  if (traduce.size) {
    console.log('Números que se REESCRIBEN en el scope al mover (nomenclatura de la superviviente):')
    for (const [de, a] of traduce) console.log(`   "${de}" → "${a}"`)
    console.log('')
  }

  console.log('\nRESUMEN DEL MOVIMIENTO')
  console.log(`   artículos emparejados con preguntas : ${mapeo.length}`)
  console.log(`   preguntas a re-anclar (todas)       : ${mapeo.reduce((n, m) => n + m.preg, 0)}`)
  console.log(`   de ellas activas                    : ${mapeo.reduce((n, m) => n + m.act, 0)}`)
  console.log(`   filas de topic_scope a re-anclar    : ${scope.length}`)

  if (!APPLY) {
    console.log('\n🔎 SIMULACIÓN — no se ha escrito nada. Repite con --apply para aplicarlo.')
    await s.end()
    return
  }

  await s.begin(async (tx) => {
    let rep = 0
    for (const a of aReparentar) {
      await tx`UPDATE articles SET law_id=${viva.id} WHERE id=${a.id}`
      rep++
    }
    let qs = 0
    let qa = 0
    for (const m of mapeo) {
      const r1 = await tx`UPDATE questions SET primary_article_id=${m.a} WHERE primary_article_id=${m.de} RETURNING id`
      qs += r1.length
      const r2 = await tx`UPDATE question_articles SET article_id=${m.a} WHERE article_id=${m.de} RETURNING question_id`
      qa += r2.length
    }
    let scMov = 0
    let scFus = 0
    for (const x of scope) {
      if (x.ya_viva) {
        const union = [...new Set([...(x.nums_viva || []), ...(traducir(x.article_numbers) || [])])]
        await tx`UPDATE topic_scope SET article_numbers=${union} WHERE id=${x.ya_viva}`
        await tx`DELETE FROM topic_scope WHERE id=${x.id}`
        scFus++
      } else {
        // Se reescriben los números a la vez que se mueve la ley: si no, un
        // "37 quater" apuntaría a un artículo que la superviviente llama "37 quáter".
        await tx`UPDATE topic_scope SET law_id=${viva.id}, article_numbers=${traducir(x.article_numbers)} WHERE id=${x.id}`
        scMov++
      }
    }
    console.log(
      `\n✅ aplicado: ${rep} artículos re-parentados · ${qs} preguntas re-ancladas · ${qa} enlaces adicionales · ${scMov} scope movidos · ${scFus} fusionados`,
    )
  })

  // Verificación posterior: los temas tienen que servir AL MENOS lo de antes.
  console.log('\nVERIFICACIÓN (preguntas de esta norma servidas por tema, ya aplicado)')
  let regresion = false
  for (const x of antes) {
    const ahora = await servidas(x.topic_id, viva.id)
    const ok = ahora >= x.hoy
    if (!ok) regresion = true
    console.log(`   ${ok ? '✅' : '❌'} ${x.position_type} T${x.topic_number}: ${x.hoy} → ${ahora}`)
  }
  const [huerfanas] = await s`
    SELECT count(*)::int n FROM questions q JOIN articles a ON a.id=q.primary_article_id
    WHERE a.law_id=${muerta.id} AND q.is_active`
  console.log(`\n   preguntas activas que siguen colgando de la fila muerta: ${huerfanas.n}`)
  if (regresion) console.log('\n⚠️ ALGÚN TEMA SIRVE MENOS QUE ANTES — revísalo antes de dar esto por bueno.')
  else console.log('\n✅ Ningún tema sirve menos que antes.')
  console.log('   Recuerda: refrescar MV (refresh_topic_question_summary) e invalidar tags.')

  await s.end()
})().catch(async (e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
