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
const { analizarLiteralidad } = require(path.join(__dirname, '..', 'lib', 'generacion', 'literalidad'))

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

const BATCH = process.argv[2]
if (!BATCH) {
  console.error('uso: node scripts/verificar-batch-generado.cjs <batch_id>')
  process.exit(1)
}

// Normalización para comparar citas: unifica comillas y espacios.
const { analizarCita } = require(path.join(__dirname, '..', 'lib', 'generacion', 'citaTruncada'))

const norm = (t) => t.replace(/[«»""'']/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

;(async () => {
  const Q = await s`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
           q.correct_option, q.explanation, a.article_number, a.content
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    WHERE ${BATCH} = ANY(q.tags)
    ORDER BY a.article_number`

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
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d]
    const correcta = opts[q.correct_option]

    // Literalidad: LITERAL (subcadena), ENUMERACION (lista fiel — pase blando,
    // la completitud la juzga la auditoría LLM) o NO_LITERAL (defecto duro).
    const lit = analizarLiteralidad(q.content, correcta)
    if (lit.estado === 'NO_LITERAL') {
      errs.push('la correcta NO es subcadena literal del artículo' +
        (lit.fragmentosNoHallados ? ` (fragmentos no hallados: ${lit.fragmentosNoHallados.join(' / ').slice(0, 60)})` : ''))
    } else {
      // Cita truncada — solo tiene sentido sobre citas contiguas.
      const cita = analizarCita(q.content, correcta)
      if (cita.estado === 'TRUNCADA') {
        errs.push(`CITA TRUNCADA: el artículo continúa con "${cita.cola}…" — la cita omite una cláusula que la condiciona`)
      }
      if (lit.estado === 'ENUMERACION') {
        warn++
        console.log(`  ⚠️ art.${q.article_number} (${q.id.slice(0, 8)}): ENUMERACIÓN — fragmentos fieles, pero la COMPLETITUD de la lista debe confirmarla la auditoría LLM`)
      }
    }

    const tl = analizarLongitud(opts, q.correct_option)
    if (tl.tell) errs.push(`TELL DE LONGITUD: ${tl.motivo}`)

    if (new Set(opts.map(norm)).size !== 4) errs.push('opciones duplicadas')

    const letra = 'ABCD'[q.correct_option]
    if (!q.explanation.startsWith(`**Por qué ${letra} es correcta:**`)) {
      errs.push('cabecera de explicación no coincide con la clave')
    }
    for (const L of 'ABCD') {
      if (L !== letra && !q.explanation.includes(`**${L})**`)) errs.push(`falta bullet del distractor ${L}`)
    }

    pos[q.correct_option] = (pos[q.correct_option] || 0) + 1
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
