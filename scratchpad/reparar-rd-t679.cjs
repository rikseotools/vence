// Paso 9 §4 — reparación de los campos editables (NO toca lifecycle_state).
//
// El agente ciego del Paso 9 encontró que 5 de las 10 preguntas citan «RD 1125/2024» sin escribir
// «Real Decreto» en ningún punto de ESA pregunta. Los tests salen barajados y sueltos (§2.2-quater:
// cada pregunta se basta sola), así que se desarrolla en el enunciado, que es donde ya aparece.
// La 6.ª (beefa097) ya dice «Real Decreto» pero deja «TIC» sin desarrollar en su propio paréntesis.
//
// Se toca SOLO `question_text`. Ni la clave, ni las opciones, ni el estado.
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')

const APLICAR = process.argv.includes('--apply')

const CAMBIOS = [
  ['1ff4ee27', 'del RD 1125/2024', 'del Real Decreto (RD) 1125/2024'],
  ['1c3c10b8', 'del RD 1125/2024', 'del Real Decreto (RD) 1125/2024'],
  ['07760a50', 'del RD 1125/2024', 'del Real Decreto (RD) 1125/2024'],
  ['f0fa945c', 'del RD 1125/2024', 'del Real Decreto (RD) 1125/2024'],
  ['c41084a5', 'del RD 1125/2024', 'del Real Decreto (RD) 1125/2024'],
  // La norma titula su propio art. 8 «Estrategia en materia de TIC», así que la sigla es suya;
  // basta desarrollarla UNA vez, en su primera aparición dentro de la pregunta.
  ['beefa097', 'la Comisión de Estrategia TIC,',
    'la Comisión de Estrategia en Tecnologías de la Información y las Comunicaciones (TIC),'],
]

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()
  let tocadas = 0
  for (const [prefijo, viejo, nuevo] of CAMBIOS) {
    const { rows } = await c.query(
      `SELECT id, question_text FROM questions WHERE id::text LIKE $1`, [prefijo + '%'])
    if (rows.length !== 1) { console.log(`❌ ${prefijo}: ${rows.length} filas`); continue }
    const actual = rows[0].question_text
    if (!actual.includes(viejo)) { console.log(`⏭  ${prefijo}: ya no contiene «${viejo}»`); continue }
    const nuevoTexto = actual.replace(viejo, nuevo)
    console.log(`· ${prefijo}\n    antes:   ${actual.slice(0, 110)}\n    después: ${nuevoTexto.slice(0, 110)}`)
    if (APLICAR) {
      await c.query(`UPDATE questions SET question_text = $1, updated_at = now() WHERE id = $2`,
        [nuevoTexto, rows[0].id])
      tocadas++
    }
  }
  console.log(APLICAR ? `\n✅ ${tocadas} enunciado(s) actualizados` : '\n(dry-run — repite con --apply)')
  await c.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
