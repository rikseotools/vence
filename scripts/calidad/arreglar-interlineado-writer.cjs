#!/usr/bin/env node
/**
 * scripts/calidad/arreglar-interlineado-writer.cjs — repara el interlineado de LibreOffice Writer
 * en el artículo de teoría y en la pregunta que afirmaba un dato falso. (08/08/2026)
 *
 * ## POR QUÉ
 *
 * Salió de la impugnación `52c5ae85` (Laura Simar, premium). Ella decía que dos opciones eran
 * válidas, y lo decía porque **nuestra propia explicación lo afirmaba**. Al medir el sistémico
 * aparecieron tres defectos, todos en las preguntas de LibreOffice:
 *
 *   · `165fee45` — explicación falsa («"Exacto" sí es una opción válida»). YA corregida.
 *   · `c8d9dbb7` — duplicada exacta de la anterior. YA jubilada (`retired_duplicate`).
 *   · `d99afeef` — **clave equivocada**: afirma que «Regleta» NO es una opción de interlineado.
 *
 * La causa de las tres es la misma: **el artículo de teoría no enumera las opciones de
 * interlineado**, así que las preguntas se escribieron sin fuente que las respaldara y cada una
 * inventó su propia lista («principal», «Como mínimo», «Interlineado»…).
 *
 * ## FUENTE (verificada el 08/08/2026, no de memoria)
 *
 * Ayuda oficial de LibreOffice, es-ES:
 * https://help.libreoffice.org/latest/es/text/shared/01/05030100.html
 * Desplegable «Interlineado» del diálogo Párrafo, en este orden:
 *   Sencillo · 1,15 renglones · 1,5 renglones · Doble · Proporcional · Por lo menos · Regleta · Fijo
 *
 * ## QUÉ HACE
 *
 * 1. Añade al artículo «Formato de texto en LibreOffice Writer» una sección de interlineado con
 *    esa lista y con la tabla de equivalencias Writer↔Word, que es justo lo que confundió a la
 *    usuaria. Idempotente: si la sección ya está, no la duplica.
 * 2. Reescribe `d99afeef`. NO se limita a mover la clave: con las opciones actuales **tres de las
 *    cuatro existen** y la cuarta («Simple») solo falla por no ser el nombre literal («Sencillo»),
 *    lo que dejaría una pregunta que se responde por un matiz de traducción. Se sustituyen las dos
 *    opciones problemáticas por una distinción real y examinable: «Múltiple» es de Word y no
 *    existe en Writer. La pregunta NO es de examen oficial (`is_official_exam=false`), así que
 *    tocar sus opciones es legítimo (manual de impugnaciones §5).
 *
 * Uso:  node scripts/calidad/arreglar-interlineado-writer.cjs [--aplicar]   (simula por defecto)
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const APLICAR = process.argv.includes('--aplicar')
const PREGUNTA = 'd99afeef-89c1-48db-b928-a8224a16bd27'
const FUENTE = 'https://help.libreoffice.org/latest/es/text/shared/01/05030100.html'

const SECCION = `
### Interlineado

El interlineado se configura en **Formato ▸ Párrafo ▸ Sangrías y espacios**. El desplegable ofrece estas ocho opciones:

| Opción | Qué hace |
|---|---|
| **Sencillo** | Espaciado de un renglón. Es el valor por defecto. |
| **1,15 renglones** | Espaciado predefinido de 1,15. |
| **1,5 renglones** | Espaciado predefinido de 1,5. |
| **Doble** | Espaciado de dos renglones. |
| **Proporcional** | Espaciado expresado en **porcentaje** del sencillo. |
| **Por lo menos** | Espaciado **mínimo**, que se amplía solo si el contenido de la línea lo necesita. |
| **Regleta** | Espacio **adicional** que se suma entre los renglones. |
| **Fijo** | Espaciado **exacto e inamovible**, no se adapta al tamaño de letra. |

⚠️ **No confundir con Microsoft Word.** Varios nombres habituales en Word **no existen** en Writer:

| En Word | En LibreOffice Writer |
|---|---|
| Múltiple | Proporcional (en porcentaje) |
| Exacto | Fijo |
| Mínimo | Por lo menos |
| — | Regleta (Word no tiene equivalente) |
`

const NUEVAS = {
  // «Simple» → «Sencillo» (el nombre literal del desplegable) y «Regleta» → «Múltiple», que es la
  // que de verdad NO existe en Writer. Así la pregunta se responde por conocer el programa y no
  // por adivinar una traducción.
  option_a: '1,5 renglones.',
  option_b: 'Sencillo.',
  option_c: 'Doble.',
  option_d: 'Múltiple.',
  correct_option: 3,
}

async function main() {
  const c = new Client(pgConfig())
  await c.connect()

  // ── 1. El artículo ──
  const art = (await c.query(
    `SELECT a.id, a.content FROM questions q JOIN articles a ON a.id = q.primary_article_id
      WHERE q.id = $1`, [PREGUNTA])).rows[0]
  if (!art) throw new Error('no encuentro el artículo de la pregunta')

  // ⚠️ La sección EXISTE y es la raíz del problema: afirma que «Regleta no existe» y lista
  // opciones inventadas («Al menos», «Mínimo», sin «1,15 renglones»). No basta con añadir: hay
  // que SUSTITUIRLA, porque es la teoría que el opositor estudia y de la que salieron las
  // preguntas. Se reemplaza desde su encabezado hasta el siguiente `###`.
  const RE_SECCION = /### Interlineado\n[\s\S]*?(?=\n### )/
  const tieneSeccion = RE_SECCION.test(art.content)
  const seccionVieja = tieneSeccion ? art.content.match(RE_SECCION)[0] : null
  const decíaFalsedad = seccionVieja ? /Regleta[^\n]*no existe/i.test(seccionVieja) : false
  console.log(`Artículo ${art.id.slice(0, 8)} · ${art.content.length} car.`)
  console.log(`  sección de interlineado: ${tieneSeccion ? `presente (${seccionVieja.length} car.)` : 'FALTA'}` +
    `${decíaFalsedad ? ' · ⚠️ afirma que «Regleta no existe», que es FALSO' : ''}`)

  let nuevoContenido = art.content
  if (tieneSeccion) {
    nuevoContenido = art.content.replace(RE_SECCION, SECCION.trim() + '\n')
  } else {
    const marca = /\n### Bordes de párrafo/
    nuevoContenido = marca.test(art.content)
      ? art.content.replace(marca, `\n${SECCION.trim()}\n\n### Bordes de párrafo`)
      : art.content + '\n' + SECCION
  }
  console.log(`  → quedaría en ${nuevoContenido.length} car. (${nuevoContenido.length - art.content.length >= 0 ? '+' : ''}${nuevoContenido.length - art.content.length})`)
  if (nuevoContenido === art.content) throw new Error('el reemplazo no cambió nada: revisa el ancla')

  // ── 2. La pregunta ──
  const q = (await c.query(
    `SELECT question_text, option_a, option_b, option_c, option_d, correct_option, is_official_exam
       FROM questions WHERE id = $1`, [PREGUNTA])).rows[0]
  if (q.is_official_exam) throw new Error('es de examen oficial: NO se tocan sus opciones')
  const antes = [q.option_a, q.option_b, q.option_c, q.option_d]
  console.log(`\nPregunta ${PREGUNTA.slice(0, 8)}`)
  console.log(`  ANTES:  ${antes.join(' | ')}  → clave ${'ABCD'[q.correct_option]} (${antes[q.correct_option]})`)
  const despues = [NUEVAS.option_a, NUEVAS.option_b, NUEVAS.option_c, NUEVAS.option_d]
  console.log(`  DESPUÉS: ${despues.join(' | ')}  → clave ${'ABCD'[NUEVAS.correct_option]} (${despues[NUEVAS.correct_option]})`)

  if (!APLICAR) { console.log('\n(simulación: nada escrito — repite con --aplicar)'); await c.end(); return }

  await c.query(`UPDATE articles SET content = $1, updated_at = now() WHERE id = $2`, [nuevoContenido, art.id])
  console.log('\n✅ artículo actualizado con la lista oficial de interlineado')
  await c.query(
    `UPDATE questions SET option_a=$1, option_b=$2, option_c=$3, option_d=$4, correct_option=$5, updated_at=now()
      WHERE id=$6`,
    [NUEVAS.option_a, NUEVAS.option_b, NUEVAS.option_c, NUEVAS.option_d, NUEVAS.correct_option, PREGUNTA])
  console.log('✅ pregunta reescrita')

  // ── 3. Comprobar releyendo, no dando por hecho ──
  const post = (await c.query(
    `SELECT option_a, option_b, option_c, option_d, correct_option FROM questions WHERE id=$1`, [PREGUNTA])).rows[0]
  const ok = post.option_d === NUEVAS.option_d && post.correct_option === NUEVAS.correct_option
  const artPost = (await c.query(`SELECT content FROM articles WHERE id=$1`, [art.id])).rows[0]
  console.log(`\n${ok ? '✅' : '❌'} relectura: clave ${'ABCD'[post.correct_option]} = ${[post.option_a, post.option_b, post.option_c, post.option_d][post.correct_option]}`)
  console.log(`${/Regleta/.test(artPost.content) ? '✅' : '❌'} el artículo ya explica «Regleta» · fuente: ${FUENTE}`)
  await c.end()
  if (!ok) process.exit(1)
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
