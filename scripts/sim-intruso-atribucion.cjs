#!/usr/bin/env node
/**
 * SIMULACIÓN — radio de impacto de ampliar `analizarIntruso` con los verbos de
 * ATRIBUCIÓN (26/07/2026, `lib/generacion/literalidad.js`).
 *
 * POR QUÉ EXISTE
 * --------------
 * `analizarIntruso` decide si el gate de generación EXENTA a una pregunta del
 * check de literalidad (§2.2 del manual `generar-preguntas-con-ia.md`). Ampliar
 * su diccionario es un cambio peligroso en UNA dirección concreta:
 *
 *   - Exentar de MENOS = falso positivo del gate. Molesto pero visible: el lote
 *     sale en rojo y alguien lo mira. Es lo que pasaba antes de este cambio.
 *   - Exentar de MÁS   = falso NEGATIVO silencioso: una pregunta cuya opción
 *     correcta NO es cita literal deja de comprobarse y entra como buena.
 *
 * El segundo error es el caro, así que el cambio no se da por bueno con tests
 * sintéticos: se mide contra el banco REAL cuántos veredictos cambia y de qué
 * signo. Mismo método que la simulación bank-wide de frontera de título
 * (`scripts/scope/sim-title-boundary.ts`) y que la lección del manual §5.bis:
 * "al escribir un check mecánico, córrelo antes contra un lote que sepas bueno".
 *
 * QUÉ MIDE
 * --------
 * Sobre TODAS las preguntas activas cuyo enunciado contiene un verbo de
 * atribución negado (el único conjunto donde el veredicto puede cambiar):
 *
 *   1. Cuántas pasan de NO-intruso a intruso (la delta real del cambio).
 *   2. De esas, cuántas eran YA literales → exentarlas no cambia nada
 *      observable: el gate las daba por buenas igual. Riesgo cero.
 *   3. De esas, cuántas eran NO_LITERAL → AQUÍ está todo el riesgo. Son las
 *      únicas cuyo veredicto se invierte. Se imprimen íntegras para
 *      adjudicación humana: si son intrusos de verdad, el cambio las repara;
 *      si no lo son, el cambio abre un agujero y hay que estrechar el patrón.
 *
 * Uso:  node scripts/sim-intruso-atribucion.cjs [--todas]
 *       --todas  imprime también las que ya eran literales (por defecto solo
 *                se listan las de riesgo, que son las que hay que juzgar).
 */
const fs = require('fs')
const path = require('path')
const pg = require('postgres')
const { analizarLiteralidad, analizarIntruso } = require(path.join(__dirname, '..', 'lib', 'generacion', 'literalidad'))

const VERBOSE = process.argv.includes('--todas')

// Réplica EXACTA del detector ANTERIOR al cambio (solo verbos de pertenencia).
// Se mantiene aquí congelada a propósito: la simulación compara contra el
// comportamiento histórico, no contra otra versión del módulo vivo.
const normalizar = (t) => String(t).replace(/[«»""'']/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
const INTRUSO_ANTERIOR =
  /\bno\s+(figura|figuran|se considera|se consideran|está|están|esta|estan|forma parte|forman parte|se incluye|se incluyen|aparece|aparecen|se beneficia|se benefician|goza|gozan|disfruta|disfrutan|se presume|se presumen|se entiende|se entienden|se prevé|se preve|se prevén|se preven|se contempla|se contemplan|se admite|se admiten|se recoge|se recogen|se enumera|se enumeran)/

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url.replace(/sslmode=[^&]*/, 'sslmode=no-verify'), {
  ssl: { rejectUnauthorized: false },
  max: 1,
  connect_timeout: 60,
  idle_timeout: 120,
})

// Único conjunto donde el veredicto PUEDE cambiar: enunciados con un verbo de
// atribución negado. Filtrar en SQL evita traerse las 139k preguntas del banco.
const VERBOS_SQL =
  'atribuye|atribuyen|confiere|confieren|otorga|otorgan|encomienda|encomiendan|reconoce|reconocen|corresponde|corresponden|enumera|enumeran|contempla|contemplan|recoge|recogen|menciona|mencionan|incluye|incluyen|cita|citan'

;(async () => {
  const filas = await s`
    SELECT q.id, q.question_text, q.correct_option,
           q.option_a, q.option_b, q.option_c, q.option_d,
           a.content AS art_content, a.article_number, l.short_name
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE q.is_active
      AND length(coalesce(a.content, '')) > 40
      AND q.question_text ~* ${'\\mno\\s+(' + VERBOS_SQL + ')\\M'}`

  const delta = []
  let yaEranIntruso = 0
  for (const q of filas) {
    const t = normalizar(q.question_text)
    const antes = INTRUSO_ANTERIOR.test(t)
    const ahora = analizarIntruso(q.question_text)
    if (antes) {
      yaEranIntruso++
      continue // el veredicto no cambia: ya estaba exenta
    }
    if (!ahora) continue // sigue sin estar exenta: el veredicto no cambia
    const opciones = [q.option_a, q.option_b, q.option_c, q.option_d]
    const correcta = opciones[q.correct_option]
    const lit = analizarLiteralidad(q.art_content, correcta)
    // SEGUNDA CAPA — criterio INVERSO del propio módulo: "en esas preguntas hay
    // que exigir literalidad a los DISTRACTORES, no a la correcta". Si la
    // correcta no es literal PERO los distractores sí lo son, el marco intruso
    // queda confirmado por la estructura de la pregunta, no por su redacción.
    // Es la prueba que convierte "parece un intruso" en "se comporta como uno".
    const distractoresLiterales = opciones.filter(
      (o, i) => i !== q.correct_option && analizarLiteralidad(q.art_content, o).estado !== 'NO_LITERAL',
    ).length
    delta.push({ ...q, correcta, estado: lit.estado, distractoresLiterales })
  }

  const riesgo = delta.filter((d) => d.estado === 'NO_LITERAL')
  const inocuas = delta.filter((d) => d.estado !== 'NO_LITERAL')

  console.log('SIMULACIÓN — ampliación de analizarIntruso con verbos de atribución')
  console.log('='.repeat(72))
  console.log(`universo analizado (activas con verbo de atribución negado): ${filas.length}`)
  console.log(`  ya exentas por el detector anterior (sin cambio):          ${yaEranIntruso}`)
  console.log(`  DELTA — pasan a exentas por el cambio:                     ${delta.length}`)
  console.log(`     · ya eran literales → exentarlas no cambia nada:        ${inocuas.length}`)
  console.log(`     · eran NO_LITERAL → el veredicto SE INVIERTE (riesgo):  ${riesgo.length}`)
  console.log('')

  // Reparto del riesgo por la SEGUNDA CAPA. Cuantos más distractores literales,
  // más seguro es que el marco intruso sea real y la exención esté justificada.
  const porDistractores = [0, 1, 2, 3].map((n) => riesgo.filter((d) => d.distractoresLiterales === n))
  console.log('--- segunda capa: ¿se comporta como un intruso? (distractores literales) ---')
  porDistractores.forEach((arr, n) => {
    const etiqueta =
      n >= 2 ? 'intruso CONFIRMADO por estructura' : n === 1 ? 'indicio débil — mirar' : 'NO se comporta como intruso — mirar'
    console.log(`  ${n}/3 distractores literales: ${String(arr.length).padStart(4)}  · ${etiqueta}`)
  })
  const dudosas = [...porDistractores[0], ...porDistractores[1]]
  console.log('')

  const listar = (arr, titulo) => {
    if (!arr.length) return
    console.log(`--- ${titulo} ---`)
    arr.forEach((d, i) => {
      console.log(`\n[${i + 1}] ${d.short_name} art.${d.article_number} (${d.id.slice(0, 8)}) · distractores literales: ${d.distractoresLiterales}/3`)
      console.log(`  ENUNCIADO: ${d.question_text}`)
      console.log(`  CORRECTA (${'ABCD'[d.correct_option]}): ${d.correcta}`)
    })
    console.log('')
  }

  listar(dudosas, `A ADJUDICAR A MANO — ${dudosas.length} sin respaldo estructural`)
  if (VERBOSE) listar(inocuas, `sin riesgo — ${inocuas.length} ya literales`)

  const confirmadas = porDistractores[2].length + porDistractores[3].length
  console.log('VEREDICTO')
  console.log('='.repeat(72))
  if (!riesgo.length) {
    console.log('✅ El cambio no invierte NINGÚN veredicto sobre el banco vivo.')
  } else {
    console.log(`   ${confirmadas}/${riesgo.length} de los veredictos invertidos quedan CONFIRMADOS como intruso`)
    console.log('   por estructura (≥2 distractores literales): ahí el detector antiguo se equivocaba')
    console.log('   y el cambio lo repara.')
    if (dudosas.length) {
      console.log(`   ⚠️  Quedan ${dudosas.length} sin respaldo estructural — listadas arriba para juicio humano.`)
      console.log('   OJO: sobre leyes VIRTUALES/editoriales (prosa, no articulado) la literalidad')
      console.log('   de los distractores baja por naturaleza, así que aquí abundan los falsos avisos.')
    }
  }

  await s.end()
})().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
