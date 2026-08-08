#!/usr/bin/env node
// Inventario previo al merge: qué toca cada rama revisada-ok sin fusionar.
const { execFileSync } = require('child_process')
const REPO = '/home/manuel/vence-sessions/movil4'
const g = (a) => { try { return execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim() } catch (e) { return `ERR:${e.message.split('\n')[0]}` } }

const ramas = process.argv.slice(2)
for (const r of ramas) {
  const stat = g(['diff', '--stat', `origin/main...${r}`, '--', '.', ':(exclude)scratchpad'])
  const commits = g(['log', '--format=%h %s', `origin/main..${r}`])
  console.log(`\n=== ${r}`)
  console.log(commits.split('\n').slice(0, 6).join('\n'))
  console.log('--- ficheros:')
  console.log(stat || '(sin diff fuera de scratchpad)')
}
