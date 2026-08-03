#!/usr/bin/env node
/**
 * Paso 7 del manual: re-verificar DESPUÉS de aplicar, sobre la pregunta VIVA en BD (no sobre el
 * JSON que se escribió), con un agente independiente. Esto solo vuelca lo que ese agente tiene
 * que leer: enunciado, opciones con la clave marcada, la explicación ya servida y el artículo
 * vinculado entero.
 *
 *   node --env-file=.env.local scripts/explicaciones/dump-vivas.cjs <lote.json> <salida.md>
 */
const fs = require('fs')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')

async function main() {
  const [lotePath, salida] = process.argv.slice(2)
  const ids = JSON.parse(fs.readFileSync(lotePath, 'utf8')).map((q) => q.id)
  const c = new Client(pgConfig())
  await c.connect()
  const r = await c.query(
    `SELECT q.id, q.question_text, q.correct_option, q.option_a, q.option_b, q.option_c, q.option_d,
            q.explanation, l.short_name ley, a.article_number, a.content art
       FROM questions q
       LEFT JOIN articles a ON a.id = q.primary_article_id
       LEFT JOIN laws l ON l.id = a.law_id
      WHERE q.id = ANY($1::uuid[])`,
    [ids],
  )
  await c.end()
  const bloques = r.rows.map((q) => {
    const ops = ['option_a', 'option_b', 'option_c', 'option_d']
      .map((k, i) => (q[k] ? `  ${q.correct_option === i ? '[CLAVE]' : '       '} ${String.fromCharCode(65 + i)}) ${q[k]}` : null))
      .filter(Boolean).join('\n')
    return `## ${q.id}\n**Norma vinculada:** ${q.ley} art. ${q.article_number}\n\n**Enunciado:** ${q.question_text}\n\n**Opciones:**\n${ops}\n\n**Explicación que se sirve ahora:**\n${q.explanation}\n\n**Artículo vinculado (texto íntegro):**\n${q.art}\n`
  })
  fs.writeFileSync(salida, `# Re-verificación de ${r.rows.length} preguntas vivas\n\n${bloques.join('\n---\n\n')}`)
  console.log(`escrito ${salida} · ${r.rows.length} preguntas`)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
