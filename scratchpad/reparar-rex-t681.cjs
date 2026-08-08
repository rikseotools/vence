// §2.2-quater — «REx 2024» es una abreviatura NUESTRA, no una sigla universal como «RD»: quien
// reciba la pregunta suelta y barajada no tiene con qué saber de qué norma se le habla. Se
// desarrolla en el ENUNCIADO, que es donde aparece primero en cada pregunta; los usos posteriores
// en la explicación quedan cubiertos por esa primera aparición.
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')

const APLICAR = process.argv.includes('--apply')
const BATCH = 'gen_pn_t11_rex2024_2026-08-08'

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()
  const { rows } = await c.query(
    `SELECT id, question_text FROM questions WHERE $1 = ANY(tags) ORDER BY id`, [BATCH])

  let tocadas = 0, yaOk = 0
  for (const q of rows) {
    const t = q.question_text
    // Ya desarrollada en esta pregunta → no se toca.
    if (/Reglamento de (la Ley Org[áa]nica 4\/2000|Extranjer[íi]a)|Real Decreto 1155\/2024|RD 1155\/2024/i.test(t)) {
      yaOk++
      continue
    }
    if (!/\bREx 2024\b/.test(t)) { console.log(`⏭  ${String(q.id).slice(0, 8)}: sin «REx 2024» en el enunciado`); continue }
    // Solo la PRIMERA aparición: repetirlo en la misma frase quedaría redundante.
    const nuevo = t.replace('REx 2024', 'Reglamento de Extranjería (REx 2024)')
    console.log(`· ${String(q.id).slice(0, 8)} → ${nuevo.slice(0, 105)}…`)
    if (APLICAR) {
      await c.query(`UPDATE questions SET question_text = $1, updated_at = now() WHERE id = $2`, [nuevo, q.id])
      tocadas++
    }
  }
  console.log(`\nya autocontenidas: ${yaOk} · ${APLICAR ? `actualizadas: ${tocadas}` : '(dry-run — repite con --apply)'}`)
  await c.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
