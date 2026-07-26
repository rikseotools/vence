#!/usr/bin/env node
/**
 * Verificador mecánico de un batch de preguntas IA-generadas, LEYENDO DE BD.
 *
 * Uso:  node scripts/verificar-batch-generado.cjs <batch_id>
 *
 * Comprueba, contra el `content` real del artículo en RDS:
 *   1. La opción correcta es subcadena LITERAL del artículo.
 *   2. **CITA TRUNCADA** — que la cita no se corte justo antes de una cláusula
 *      que condiciona su alcance («salvo», «excepto», «sin perjuicio», «así
 *      como», «siempre que»…). Este es el modo de fallo de §2.2 del manual
 *      (cláusula coordinada omitida): la cita ES literal pero cambia el sentido
 *      al presentar como incondicional lo que la ley condiciona.
 *      Detectado en el piloto ISD (art. 3.1.c, omitía «salvo los supuestos
 *      expresamente regulados en el artículo 16.2 a) LIRPF»). Un check de
 *      subcadena a secas NO lo ve; este sí.
 *   3. Distractores dentro de ±30% de longitud de la correcta (§2.2-bis).
 *   4. Las 4 opciones distintas entre sí.
 *   5. Cabecera de la explicación coherente con `correct_option` y un bullet
 *      por cada distractor (§2.2-ter, recordatorio de coherencia).
 *   6. Distribución y secuencia de `correct_option` (§2.2-ter, anti-"siempre la B").
 *
 * NO sustituye a la auditoría LLM: la exhaustividad de la explicación y la
 * ambigüedad de un distractor no son mecanizables. Es el filtro barato que va
 * ANTES, para no gastar auditoría en fallos que detecta una regex.
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
const { analizarLongitud } = require(path.join(__dirname, '..', 'lib', 'generacion', 'tellLongitud'))
const { analizarLiteralidad, resolverMarco } = require(path.join(__dirname, '..', 'lib', 'generacion', 'literalidad'))
const { analizarCabecera } = require(path.join(__dirname, '..', 'lib', 'generacion', 'cabeceraExplicacion'))
const { analizarSiglas } = require(path.join(__dirname, '..', 'lib', 'generacion', 'siglasSinDesarrollar'))
const { analizarOverclaim } = require(path.join(__dirname, '..', 'lib', 'generacion', 'overclaimExplicacion'))
const { analizarCitaVsOpcion } = require(path.join(__dirname, '..', 'lib', 'generacion', 'citaVsOpcion'))

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

const BATCH = process.argv[2]
if (!BATCH) {
  console.error('uso: node scripts/verificar-batch-generado.cjs <batch_id>')
  process.exit(1)
}

// Normalización para comparar citas: unifica comillas y espacios.
const { analizarCita, clausulaEnEnunciado } = require(path.join(__dirname, '..', 'lib', 'generacion', 'citaTruncada'))

const norm = (t) => t.replace(/[«»""'']/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

;(async () => {
  const Q = await s`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
           q.correct_option, q.explanation, a.article_number, a.content
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    WHERE ${BATCH} = ANY(q.tags)
    -- Desempate explícito: sin él el informe salía en orden distinto en cada
    -- ejecución (los empates de article_number quedaban al criterio del plan), y
    -- dos corridas seguidas del MISMO batch parecían decir cosas distintas —
    -- incluida la "secuencia" de correct_option, que se lee como si fuera el
    -- orden real de las preguntas.
    ORDER BY a.article_number, q.created_at, q.id`

  if (!Q.length) {
    console.log(`No hay preguntas con el tag "${BATCH}".`)
    await s.end()
    return
  }

  let fail = 0
  const pos = {}

  let warn = 0
  for (const q of Q) {
    const errs = []
    const avisos = []
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d]
    const correcta = opts[q.correct_option]

    // Preguntas INTRUSO ("¿cuál NO figura…?"): la correcta es por construcción la
    // opción INVENTADA y las literales son los distractores. Exigirle literalidad
    // a la correcta es un falso positivo garantizado, así que el criterio se
    // invierte: se comprueba que los TRES distractores sí sean del artículo.
    //
    // El marco NO se decide solo por la redacción del enunciado: `resolverMarco`
    // deja que la EVIDENCIA lo desmienta (si la correcta es cita literal, no era
    // un intruso). Sin eso, un enunciado que cita la negación de la propia ley
    // —art. 5.1 RDL 1/1993— pedía literalidad a los distractores inventados y
    // dejaba la cita real sin verificar. Ver `lib/generacion/literalidad.js`.
    const marco = resolverMarco(q.content, opts, q.correct_option, q.question_text)
    const intruso = marco.marco === 'INTRUSO'
    if (intruso && marco.distractoresNoLiterales.length) {
      errs.push(`INTRUSO: ${marco.distractoresNoLiterales.length} de los 3 distractores no son literales del artículo (deberían serlo)`)
    }
    // Pista desmentida: el enunciado pide "la que NO figura" pero la opción marcada
    // como correcta SÍ aparece en el artículo. O el enunciado no era un intruso
    // (redacción que cita la negación de la ley: correcto, pasa) o la CLAVE está
    // mal (la opción sí figura, así que no es la intrusa). Aviso, no error: el
    // gate no puede distinguirlo, lo mira el auditor.
    if (marco.pista && !intruso && marco.distractoresNoLiterales.length === 3) {
      avisos.push(
        'MARCO AMBIGUO: el enunciado suena a "¿cuál NO figura?" pero la correcta SÍ es del artículo ' +
        `(${marco.literalidadCorrecta.estado}) y los 3 distractores no — si de verdad es un intruso, la CLAVE está mal`,
      )
    }

    // Literalidad: LITERAL (subcadena), ENUMERACION (lista fiel — pase blando,
    // la completitud la juzga la auditoría LLM) o NO_LITERAL (defecto duro).
    const lit = intruso ? { estado: 'LITERAL' } : marco.literalidadCorrecta
    if (lit.estado === 'NO_LITERAL') {
      errs.push('la correcta NO es subcadena literal del artículo' +
        (lit.fragmentosNoHallados ? ` (fragmentos no hallados: ${lit.fragmentosNoHallados.join(' / ').slice(0, 60)})` : ''))
    } else {
      // Cita truncada — solo tiene sentido sobre citas contiguas.
      const cita = analizarCita(q.content, correcta)
      if (cita.estado === 'TRUNCADA') {
        // §2.2: si la cláusula que se "omite" ya está en el ENUNCIADO, es condensación
        // VÁLIDA, no truncamiento. `analizarCita` no ve el enunciado; aquí sí lo tenemos.
        if (cita.lado === 'cabeza' && clausulaEnEnunciado(cita.cola, q.question_text)) {
          avisos.push(`cita truncada por la cabeza ("${cita.cola}") pero la cláusula ya aparece en el enunciado — condensación válida §2.2`)
        } else {
          errs.push(`CITA TRUNCADA (${cita.lado}): ${cita.lado === 'cabeza' ? `el artículo antepone "${cita.cola}"` : `el artículo continúa con "${cita.cola}…"`} — la cita omite una cláusula que la condiciona`)
        }
      }
      if (lit.estado === 'ENUMERACION') {
        warn++
        console.log(`  ⚠️ art.${q.article_number} (${q.id.slice(0, 8)}): ENUMERACIÓN — fragmentos fieles, pero la COMPLETITUD de la lista debe confirmarla la auditoría LLM`)
      }
      if (lit.estado === 'ORTOGRAFIA') {
        warn++
        console.log(`  ⚠️ art.${q.article_number} (${q.id.slice(0, 8)}): ORTOGRAFÍA — la cita es fiel salvo tildes; revisa si el texto importado del artículo tiene la grafía correcta`)
      }
    }

    const tl = analizarLongitud(opts, q.correct_option)
    if (tl.tell) errs.push(`TELL DE LONGITUD: ${tl.motivo}`)

    if (new Set(opts.map(norm)).size !== 4) errs.push('opciones duplicadas')

    const letra = 'ABCD'[q.correct_option]
    const cab = analizarCabecera(q.explanation, q.correct_option)
    if (!cab.ok) errs.push(`cabecera de explicación: ${cab.motivo}`)
    for (const L of 'ABCD') {
      if (L !== letra && !q.explanation.includes(`**${L})**`)) errs.push(`falta bullet del distractor ${L}`)
    }

    // §2.2-quater: la pregunta sale barajada y suelta, así que la sigla se
    // desarrolla EN ELLA. Se colaron 73 enunciados con IGIC/AIEM a pelo porque
    // el gate no lo miraba (lote ATC Canaria, 25/07/2026).
    const sig = analizarSiglas(q.question_text, q.explanation, opts)
    if (sig.faltan.length) {
      errs.push(`SIGLA SIN DESARROLLAR (§2.2-quater): ${sig.faltan.join(', ')} — da el nombre completo en su primera aparición y deja la sigla entre paréntesis`)
    }
    if (sig.candidatas.length) {
      avisos.push(`posible sigla no catalogada: ${sig.candidatas.join(', ')} — si es una norma o tributo, añádela al diccionario de lib/generacion/siglasSinDesarrollar.js`)
    }

    // OVERCLAIM: el razonamiento afirma más que el artículo ("sin excepción",
    // "sin excluir clase alguna"…). AVISO, no error: hay glosas absolutas
    // correctas. Comprueba el ARTÍCULO antes de tocar nada — si el límite lo
    // pone otro precepto de la misma ley, nómbralo en vez de negarlo.
    const over = analizarOverclaim(q.explanation, q.content)
    for (const o of over.avisos) {
      avisos.push(`OVERCLAIM ("${o.termino}"): «${o.frase.slice(0, 120)}» — el artículo no dice ese absoluto; comprueba si otro artículo de la ley pone el límite`)
    }

    // CORRECTA PARCIAL: el blockquote que aportas como prueba dice MÁS que la
    // opción que marcas correcta (§2.2). AVISO: o acotas el enunciado, o
    // completas la opción. Tres lotes de la campaña T-115 cayeron aquí.
    // Se le pasa el ENUNCIADO (26/07/2026): si la cola omitida ya está en él, es
    // condensación válida. Sin esto el lote `gen_atc_t225_2026-07-26_s26c` sacaba 6
    // avisos de 16, todos del mismo patrón inocuo (la opción completa la frase y el
    // predicado está en la pregunta) — el nivel de ruido que enseña a ignorar el gate.
    const parcial = analizarCitaVsOpcion(q.explanation, correcta, q.question_text)
    if (parcial.aviso) {
      avisos.push(`CORRECTA PARCIAL: la cita de la explicación continúa con «${parcial.cola.slice(0, 110)}» y la opción correcta no lo recoge — acota el enunciado o completa la opción`)
    }

    pos[q.correct_option] = (pos[q.correct_option] || 0) + 1
    for (const a of avisos) console.log(`  ⚠️ art.${q.article_number} (${q.id.slice(0, 8)}): ${a}`)
    if (errs.length) {
      fail++
      console.log(`  ❌ art.${q.article_number} (${q.id.slice(0, 8)}): ${errs.join(' | ')}`)
    }
  }

  console.log(`\n${Q.length - fail}/${Q.length} OK · ${fail} con fallos`)
  console.log('distribución: ' + [0, 1, 2, 3].map((k) => `${'ABCD'[k]}=${pos[k] || 0}`).join(' '))
  console.log('secuencia: ' + Q.map((q) => 'ABCD'[q.correct_option]).join(','))

  await s.end()
  if (fail) process.exit(2)
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
