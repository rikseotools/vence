#!/usr/bin/env node
/**
 * Corrige el ENUNCIADO de una pregunta viva y deja rastro.
 *
 * En este cubo aparecen de paso enunciados defectuosos que no son el defecto que se venía a reparar
 * (la explicación): normas citadas que no son la vinculada, números de artículo equivocados, siglas
 * sin desarrollar, placeholders sin sustituir. Corregirlos a pelo con un UPDATE no deja constancia
 * de que alguien lo miró ni de por qué, así que esto hace las dos cosas en una transacción.
 *
 *   node --env-file=.env.local scripts/explicaciones/corregir-enunciado.cjs <question_id> <fichero.txt> "<motivo>"
 *
 * El texto nuevo va en un fichero para no pelearse con el escapado del shell.
 * Sin `--apply` no escribe: imprime el antes y el después.
 */
const fs = require('fs')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')

async function main() {
  const [id, ficheroTexto, motivo] = process.argv.slice(2)
  const aplicar = process.argv.includes('--apply')
  if (!id || !ficheroTexto || !motivo) {
    console.error('uso: corregir-enunciado.cjs <question_id> <fichero.txt> "<motivo>" [--apply]')
    process.exit(2)
  }
  const nuevo = fs.readFileSync(ficheroTexto, 'utf8').trim()
  const c = new Client(pgConfig())
  await c.connect()
  try {
    const { rows } = await c.query('SELECT id, question_text FROM questions WHERE id = $1', [id])
    if (!rows.length) throw new Error('no existe esa pregunta')
    const anterior = rows[0].question_text
    console.log('ANTES :', anterior)
    console.log('DESPUÉS:', nuevo)
    console.log('MOTIVO :', motivo)
    if (anterior.trim() === nuevo) { console.log('· sin cambios, no se escribe'); return }
    if (!aplicar) { console.log('\n(dry-run: añade --apply para escribir)'); return }

    await c.query('BEGIN')
    await c.query('UPDATE questions SET question_text = $2 WHERE id = $1', [id, nuevo])
    await c.query(
      `INSERT INTO observable_events (source, severity, event_type, metadata)
       VALUES ('scripts/t409', 'info', 'enunciado_referencia_corregida', $1::jsonb)`,
      [JSON.stringify({ questionId: id, motivo, anterior, nuevo, tarea: 'T-409' })],
    )
    await c.query('COMMIT')
    console.log('\n✅ enunciado corregido y evento emitido')
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    await c.end()
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
