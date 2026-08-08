#!/usr/bin/env node
/**
 * scripts/calidad/autocontener-pregunta.cjs — antepone al enunciado la norma/comunidad de la que
 * procede la respuesta, para que la pregunta deje de engañar a quien estudia en otro sitio. (T-732)
 *
 * ## POR QUÉ
 *
 * En materias con protocolo autonómico (residuos sanitarios, higiene del paciente) **la clave
 * cambia según la comunidad**. Dos ejemplos reales del banco, servidos en los MISMOS temas:
 *
 *   · «Los residuos sanitarios citostáticos se recogerán:» → ROJO (Reglamento de Residuos de
 *     Andalucía, Decreto 73/2012)
 *   · «Los residuos de tipo VI como los citostáticos, ¿en qué contenedores…?» → AZUL (Decreto
 *     83/1999 de la Comunidad de Madrid)
 *
 * Las dos son correctas EN SU COMUNIDAD y ninguna lo decía. Un opositor de Madrid recibía la
 * andaluza, la fallaba y aprendía «rojo». Lo destapó la impugnación `61b34908`.
 *
 * ## LO QUE HACE Y LO QUE NO
 *
 * Añade el prefijo al enunciado y nada más: **no toca la clave, ni las opciones, ni el scope**. No
 * es la solución completa —lo ideal es que cada comunidad reciba solo lo suyo, que exige artículos
 * por comunidad— pero sí quita el daño grave: quien la lea sabrá que ese dato no es el suyo.
 *
 * ⚠️ **El prefijo lo escribe una persona tras VERIFICAR la norma en su fuente oficial.** No se
 * deduce de la explicación: la explicación es justo lo que estaba mal en el caso que originó esto
 * (empezaba diciendo «en la normativa nacional son de color AZUL» en una pregunta cuya clave era
 * la andaluza).
 *
 * Se niega a tocar preguntas de EXAMEN OFICIAL: ahí el enunciado es intocable (manual de
 * impugnaciones §5) y la salida es re-anclar, no reescribir.
 *
 * Uso:
 *   node scripts/calidad/autocontener-pregunta.cjs <question_id> --prefijo "Según el Decreto 83/1999 de la Comunidad de Madrid," [--aplicar]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const argv = process.argv.slice(2)
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
const APLICAR = argv.includes('--aplicar')
const ID = argv.find((a) => !a.startsWith('--') && a !== arg('--prefijo'))
const PREFIJO = arg('--prefijo')

/**
 * Coletillas vagas que hay que RETIRAR al poner el prefijo: son las que crean el engaño («¿según
 * qué normativa vigente?») y, dejadas al final, el enunciado se contradice consigo mismo —
 * «Según el Decreto 83/1999 de la Comunidad de Madrid, … según la normativa vigente?».
 */
const COLETILLAS = [
  /,?\s*seg[úu]n (la )?normativa (vigente|aplicable|actual)\s*(?=[?.:]|$)/gi,
  /,?\s*conforme a (la )?normativa (vigente|aplicable)\s*(?=[?.:]|$)/gi,
  /,?\s*de acuerdo con (la )?normativa (vigente|aplicable)\s*(?=[?.:]|$)/gi,
]

/**
 * Arranques genéricos que el prefijo SUSTITUYE, en vez de acumularse sobre ellos.
 *
 * Medido reparando el banco: «Según la norma para el tratamiento de residuos sanitarios, los
 * envases azules…» quedaba como *«Según el Decreto 83/1999 de la Comunidad de Madrid, según la
 * norma para el tratamiento de residuos sanitarios, los envases…»*. Dos «según» seguidos. Y son
 * justo los enunciados que hay que reparar: el que dice «la norma» sin decir cuál.
 */
const ARRANQUES_VAGOS = [
  /^Seg[úu]n (la |el )?(norma|normativa|legislaci[óo]n|reglamentaci[óo]n)[^,]{0,60},\s*/i,
  /^Conforme a (la |el )?(norma|normativa|legislaci[óo]n)[^,]{0,60},\s*/i,
  /^De acuerdo con (la |el )?(norma|normativa|legislaci[óo]n)[^,]{0,60},\s*/i,
]

/** Une prefijo y enunciado sin duplicar mayúscula ni dejar la frase coja. */
function componer(prefijo, enunciado) {
  const p = String(prefijo).trim().replace(/[,:]\s*$/, '')
  let e = String(enunciado).trim()
  for (const re of COLETILLAS) e = e.replace(re, '')
  for (const re of ARRANQUES_VAGOS) {
    if (re.test(e)) { e = e.replace(re, ''); e = e[0] ? e[0].toUpperCase() + e.slice(1) : e; break }
  }
  e = e.replace(/\s+([?.:])/g, '$1').trim()
  // El enunciado pasa a minúscula inicial solo si empieza por una palabra corriente; si empieza
  // por una sigla o un nombre propio (SERMAS, Los Delegados…) se respeta tal cual.
  const primera = e.split(/\s+/)[0] || ''
  const bajar = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(primera)
  const resto = bajar ? e[0].toLowerCase() + e.slice(1) : e
  return `${p}, ${resto}`
}

async function main() {
  if (!ID || !PREFIJO) throw new Error('uso: <question_id> --prefijo "Según … de <comunidad>," [--aplicar]')
  const c = new Client(pgConfig())
  await c.connect()

  const q = (await c.query(
    `SELECT id, question_text, is_official_exam FROM questions WHERE id::text LIKE $1`, [ID + '%'])).rows[0]
  if (!q) throw new Error(`no encuentro la pregunta ${ID}`)
  if (q.is_official_exam) throw new Error('es de EXAMEN OFICIAL: no se toca el enunciado (§5 del manual)')

  const nuevo = componer(PREFIJO, q.question_text)
  console.log(`\n${q.id}`)
  console.log(`  ANTES:   ${q.question_text.replace(/\s+/g, ' ')}`)
  console.log(`  DESPUÉS: ${nuevo}`)

  if (/^Seg[úu]n .*(Decreto|Ley|Reglamento|Orden)/i.test(q.question_text)) {
    console.log('\n  ℹ️  el enunciado YA empieza citando una norma — comprueba que no la estás duplicando')
  }
  if (!APLICAR) { console.log('\n(simulación: nada escrito — repite con --aplicar)\n'); await c.end(); return }

  await c.query(`UPDATE questions SET question_text=$1, updated_at=now() WHERE id=$2`, [nuevo, q.id])
  const post = (await c.query(`SELECT question_text FROM questions WHERE id=$1`, [q.id])).rows[0]
  const ok = post.question_text === nuevo
  console.log(`\n  ${ok ? '✅' : '❌'} releído de la BD: ${ok ? 'coincide' : 'NO coincide'}\n`)
  await c.end()
  if (!ok) process.exit(1)
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
module.exports = { componer }
