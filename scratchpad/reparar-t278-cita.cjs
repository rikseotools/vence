// Paso 9 §4 — reparación de dos defectos que encontró el agente ciego en el lote de
// Mecánico-Conductor T10. Solo campos editables; ni clave, ni opciones, ni lifecycle_state.
//
// 1) 553942c6 — CITA TRUNCADA POR LA COLA, sin marcar. El art. 48.1.e) del RGC no acaba en «45
//    kilómetros por hora»: sigue con «No obstante, los conductores de bicicletas podrán superar
//    dicha velocidad máxima…». La explicación presentaba el límite como absoluto y encima lo
//    llamaba «cita literal». Se completa el blockquote con el apartado ENTERO (ahí no aplica el
//    paralelismo de longitudes, que es cosa de las opciones) y se añade la salvedad como nota,
//    que además es materia útil.
//
// 2) RGC crudo en el enunciado de las 22. La sigla se desarrollaba solo en la cabecera de la
//    explicación — que el opositor ve DESPUÉS de responder. §2.2-quater pide la primera aparición
//    DENTRO de la pregunta, y el enunciado va antes.
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')

const APLICAR = process.argv.includes('--apply')
const BATCH = 'gen_mecanico_conductor_estado_t10_2026-08-08'

const CITA_VIEJA = '> "Para ciclos, ciclomotores de dos y tres ruedas y cuadriciclos ligeros: 45 kilómetros por hora."'
const CITA_NUEVA =
  '> "Para ciclos, ciclomotores de dos y tres ruedas y cuadriciclos ligeros: 45 kilómetros por hora. ' +
  'No obstante, los conductores de bicicletas podrán superar dicha velocidad máxima en aquellos tramos ' +
  'en los que las circunstancias de la vía permitan desarrollar una velocidad superior."'
const NOTA =
  '\n\n**Ojo a la salvedad del propio apartado:** el límite de 45 km/h no es absoluto para las ' +
  'bicicletas — el art. 48.1.e) permite superarlo en los tramos en que las circunstancias de la vía ' +
  'lo consientan. La cifra que pide la pregunta sigue siendo 45 km/h, que es el límite de la categoría.'

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()

  // ── 1) la cita truncada
  const { rows: [tr] } = await c.query(
    `SELECT id, explanation FROM questions WHERE id::text LIKE '553942c6%'`)
  if (tr && tr.explanation.includes(CITA_VIEJA)) {
    const nueva = tr.explanation.replace(CITA_VIEJA, CITA_NUEVA) + NOTA
    console.log('· 553942c6 — cita completada con la salvedad de las bicicletas')
    if (APLICAR) await c.query(`UPDATE questions SET explanation=$1, updated_at=now() WHERE id=$2`, [nueva, tr.id])
  } else {
    console.log('⏭  553942c6 — la cita ya no es la esperada')
  }

  // ── 2) RGC crudo en el enunciado
  const { rows } = await c.query(
    `SELECT id, question_text FROM questions WHERE $1 = ANY(tags) ORDER BY id`, [BATCH])
  let n = 0
  for (const q of rows) {
    const t = q.question_text
    if (/Reglamento General de Circulaci[óo]n/i.test(t)) continue
    if (!/\bRGC\b/.test(t)) continue
    const nuevo = t.replace('RGC', 'Reglamento General de Circulación (RGC)')
    if (APLICAR) await c.query(`UPDATE questions SET question_text=$1, updated_at=now() WHERE id=$2`, [nuevo, q.id])
    n++
  }
  console.log(`· RGC desarrollado en ${n} enunciado(s)`)
  console.log(APLICAR ? '\n✅ aplicado' : '\n(dry-run — repite con --apply)')
  await c.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
