#!/usr/bin/env node
/**
 * Simulación del guardarraíl del punto 6 de T-443: ejecuta el MISMO bloque que
 * `scripts/deploy-cuando-verde.sh` corre antes de su `git reset --hard origin/main`,
 * sobre repositorios de git DE VERDAD construidos aquí.
 *
 * No basta con que el criterio esté testeado: lo que destruía trabajo era el cableado
 * (un árbol limpio con commits sin empujar), así que hay que verlo PARAR sobre un repo
 * real, no sobre un objeto fabricado a mano.
 *
 * No escribe nada fuera de su directorio temporal y no toca el repo desde el que se lanza.
 *
 *   node scripts/deploy/sim-reset-commits.cjs
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { puedeResetear } = require('../../lib/deploy/commitsSinEmpujar.cjs')

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** Reproduce, tal cual, lo que hace el lanzador antes de resetear. */
function veredictoDelLanzador(cwd, escape = '') {
  let porDelante = null
  let resumen = []
  try {
    porDelante = Number(git(cwd, 'rev-list', '--count', 'origin/main..HEAD'))
    resumen = git(cwd, 'log', '--oneline', 'origin/main..HEAD').split('\n').filter(Boolean)
  } catch {
    porDelante = null
  }
  return puedeResetear({ commitsPorDelante: porDelante, resumenCommits: resumen, escape })
}

function montarRepos(base) {
  const remoto = path.join(base, 'remoto.git')
  const trabajo = path.join(base, 'trabajo')
  fs.mkdirSync(remoto, { recursive: true })
  git(remoto, 'init', '--bare', '--initial-branch=main', '.')
  git(base, 'clone', '-q', remoto, 'trabajo')
  git(trabajo, 'config', 'user.email', 'sim@vence.local')
  git(trabajo, 'config', 'user.name', 'sim')
  fs.writeFileSync(path.join(trabajo, 'a.txt'), 'base\n')
  git(trabajo, 'add', 'a.txt')
  git(trabajo, 'commit', '-qm', 'base')
  git(trabajo, 'push', '-q', 'origin', 'main')
  return { remoto, trabajo }
}

function commitLocal(trabajo, texto) {
  fs.writeFileSync(path.join(trabajo, 'a.txt'), texto + '\n')
  git(trabajo, 'commit', '-aqm', texto)
}

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-reset-'))
let fallos = 0
const comprueba = (nombre, ok, extra = '') => {
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${extra ? ' — ' + extra : ''}`)
  if (!ok) fallos++
}

try {
  const { trabajo } = montarRepos(base)

  console.log('\n1) árbol al día (lo normal): tiene que DEJAR desplegar')
  git(trabajo, 'fetch', '-q', 'origin')
  let v = veredictoDelLanzador(trabajo)
  comprueba('deja pasar', v.permite === true, `motivo=${v.motivo}`)

  console.log('\n2) árbol LIMPIO con un commit sin empujar: el caso que destruía trabajo')
  commitLocal(trabajo, 'trabajo-de-otra-sesion')
  const sucio = git(trabajo, 'status', '--porcelain', '--untracked-files=no')
  comprueba('git status sale LIMPIO (por eso la otra guarda no lo veía)', sucio === '')
  v = veredictoDelLanzador(trabajo)
  comprueba('PARA el deploy', v.permite === false, `motivo=${v.motivo}`)
  comprueba('nombra el commit en peligro', v.mensaje.includes('trabajo-de-otra-sesion'))

  console.log('\n3) dos commits: los cuenta y los enseña')
  commitLocal(trabajo, 'segundo-commit')
  v = veredictoDelLanzador(trabajo)
  comprueba('sigue parando', v.permite === false)
  comprueba('dice que son 2', v.mensaje.includes('2 commit(s)'))

  console.log('\n4) escape sin motivo de verdad: NO vale')
  v = veredictoDelLanzador(trabajo, '1')
  comprueba('rechaza DEPLOY_RESET_OK=1', v.permite === false, `motivo=${v.motivo}`)

  console.log('\n5) escape con motivo explicado: pasa y queda dicho')
  v = veredictoDelLanzador(trabajo, 'son fixtures de un test, los descarto a propósito')
  comprueba('deja pasar', v.permite === true)
  comprueba('imprime el motivo', v.mensaje.includes('son fixtures'))

  console.log('\n6) tras empujar, vuelve a dejar desplegar (la salida que se le propone al usuario)')
  git(trabajo, 'push', '-q', 'origin', 'main')
  git(trabajo, 'fetch', '-q', 'origin')
  v = veredictoDelLanzador(trabajo)
  comprueba('deja pasar', v.permite === true, `motivo=${v.motivo}`)
} finally {
  fs.rmSync(base, { recursive: true, force: true })
}

console.log(fallos === 0 ? '\n✅ simulación OK\n' : `\n❌ ${fallos} comprobación(es) fallidas\n`)
process.exit(fallos === 0 ? 0 : 1)
