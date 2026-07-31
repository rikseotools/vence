// Verificación de T-429: la deriva ficha↔BD tiene que quedar a CERO tras el triaje.
// Usa el MISMO núcleo que el CLI y el guardarraíl (lib/backlog/claim), no una copia.
import { readFileSync } from 'fs'
import { Client } from 'pg'
import { parseBacklogMarkdown, findBacklogDrift } from '../../lib/backlog/claim'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

;(async () => {
  const md = readFileSync('docs/roadmap/tareas-pendientes.md', 'utf8')
  const fichas = parseBacklogMarkdown(md)
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()
  const { rows } = await c.query(`SELECT id, status, title, priority FROM backlog_tasks`)
  await c.end()
  const drift = findBacklogDrift(fichas as any, rows as any)
  console.log(`fichas en markdown: ${fichas.length} · filas en BD: ${rows.length}`)
  const relevantes = {
    cerradaPeroAbiertaEnMarkdown: drift.cerradaPeroAbiertaEnMarkdown,
    vivaPeroCerradaEnMarkdown: drift.vivaPeroCerradaEnMarkdown,
  }
  console.log('DERIVA de estado (lo que triaba T-429):')
  console.dir(relevantes, { depth: 3 })
  console.log(`(informativo) soloEnBd=${drift.soloEnBd.length} · soloEnMarkdown=${drift.soloEnMarkdown.length}`)
  const total = relevantes.cerradaPeroAbiertaEnMarkdown.length + relevantes.vivaPeroCerradaEnMarkdown.length
  console.log(total === 0 ? 'OK: deriva de estado a CERO' : `PENDIENTE: ${total}`)
  process.exit(total === 0 ? 0 : 1)
})()
