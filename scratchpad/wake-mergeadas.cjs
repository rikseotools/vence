#!/usr/bin/env node
// Devuelve al pool las tareas cuyo entregable YA está mergeado en main.
const { execFileSync } = require('child_process')
const ids = process.argv.slice(2)
for (const id of ids) {
  try {
    const out = execFileSync('node', ['scripts/backlog.cjs', 'wake', id], {
      cwd: '/home/manuel/vence-sessions/movil4', encoding: 'utf8',
    })
    console.log(out.trim().split('\n').slice(-2).join(' | '))
  } catch (e) {
    console.log(`${id}: ERROR ${String(e.stdout || e.message).trim().split('\n').slice(-1)[0]}`)
  }
}
