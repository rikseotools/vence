#!/usr/bin/env node
/**
 * sim-codigo-guard.cjs — CALIBRA el detector de código suprimido (T-443) contra la historia real.
 *
 * Recorre los commits que tocan la infraestructura de coordinación (scripts/*.cjs de raíz,
 * lib/backlog/**, lib/sessions/**, lib/calidad/**, .husky/*), compara cada uno con su primer
 * padre por CADA fichero tocado, y pasa las dos versiones por `lib/backlog/codigoSuprimido.cjs`.
 * NO escribe nada: solo lee git y cuenta.
 *
 * Uso:
 *   node scripts/backlog/sim-codigo-guard.cjs                  (resumen + peores casos)
 *   node scripts/backlog/sim-codigo-guard.cjs --min 15         (probar otro umbral)
 *   node scripts/backlog/sim-codigo-guard.cjs --desde 2026-06-01
 */
const { execFileSync } = require('child_process')
const { findCodigoSuprimido, MIN_LINEAS_SUPRIMIDAS } = require('../../lib/backlog/codigoSuprimido.cjs')

const RUTAS = ['scripts/*.cjs', 'lib/backlog', 'lib/sessions', 'lib/calidad', '.husky']

const argv = process.argv.slice(2)
const flag = (n, def) => {
  const i = argv.indexOf(n)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const MIN = Number(flag('--min', MIN_LINEAS_SUPRIMIDAS))
const DESDE = flag('--desde', '2026-06-01')

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 128 })

function leer(sha, ruta) {
  try {
    return execFileSync('git', ['show', `${sha}:${ruta}`], {
      encoding: 'utf8', maxBuffer: 1024 * 1024 * 64, stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null // no existía en ese commit (fichero nuevo, o borrado)
  }
}

const commits = git(['log', '--since', DESDE, '--format=%H', '--', ...RUTAS]).trim().split('\n').filter(Boolean)
console.log(`→ ${commits.length} commit(s) desde ${DESDE} sobre ${RUTAS.join(', ')}`)
console.log(`→ umbral: ≥${MIN} líneas significativas suprimidas en UN fichero\n`)

const filas = []
let sinPadre = 0

for (const sha of commits) {
  let padre
  try {
    padre = git(['rev-parse', `${sha}^1`]).trim()
  } catch {
    sinPadre++
    continue
  }
  // Ficheros de la ruta escopada tocados por este commit
  const tocados = git(['diff', '--name-only', padre, sha, '--', ...RUTAS]).trim().split('\n').filter(Boolean)
  for (const ruta of tocados) {
    const antes = leer(padre, ruta)
    const despues = leer(sha, ruta)
    if (antes === null || despues === null) continue // fichero nuevo o borrado: no es supresión parcial
    const r = findCodigoSuprimido(antes, despues)
    if (r.total < MIN) continue
    filas.push({ sha: sha.slice(0, 9), ruta, ...r })
  }
}

console.log('══ RESUMEN ' + '═'.repeat(60))
console.log(`   commits analizados       : ${commits.length - sinPadre}`)
const commitsConError = new Set(filas.map((f) => f.sha))
console.log(`   commits que dispararían  : ${commitsConError.size}  (${((commitsConError.size / Math.max(1, commits.length - sinPadre)) * 100).toFixed(1)}%)`)
console.log(`   hallazgos                : ${filas.length}`)

filas.sort((a, b) => b.total - a.total)
console.log('\n══ PEORES CASOS ' + '═'.repeat(55))
for (const f of filas.slice(0, 25)) {
  const asunto = git(['log', '-1', '--format=%s', f.sha]).trim()
  const fecha = git(['log', '-1', '--format=%ad', '--date=short', f.sha]).trim()
  console.log(`   ${f.sha}  ${fecha}  −${String(f.total).padStart(4)} líneas (${(f.ratio * 100).toFixed(0)}%)  ${f.ruta}`)
  console.log(`        ${asunto.slice(0, 90)}`)
}

console.log('')
