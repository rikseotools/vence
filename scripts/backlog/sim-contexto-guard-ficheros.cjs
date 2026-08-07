#!/usr/bin/env node
/**
 * sim-contexto-guard-ficheros.cjs — simulación de EXTREMO A EXTREMO del guardarraíl de T-428,
 * adaptada a T-532: cada ficha vive en su propio fichero (`docs/roadmap/tareas/T-nnn.md`).
 *
 * Hermana de sim-contexto-guard.cjs (que sigue viva y en verde, protegiendo el índice generado
 * como fallback legacy). Ésta prueba la protección PRINCIPAL: borrar/vaciar el FICHERO de una
 * ficha ajena tiene que bloquear el push igual que borrarla dentro del monolito bloqueaba antes.
 *
 * No toca el repo de Vence: todo bajo un directorio temporal que se borra al salir.
 *
 * Uso:  node scripts/backlog/sim-contexto-guard-ficheros.cjs [--conservar]
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const BRIDGE = path.join(__dirname, '..', 'contexto-push-guard.cjs')
const DIR = 'docs/roadmap/tareas'
const CONSERVAR = process.argv.includes('--conservar')

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'vence-sim-contexto-fichero-'))
const remoto = path.join(raiz, 'remoto.git')
const trabajo = path.join(raiz, 'sesion')

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

const ficha = (id, n, hecha = false) =>
  `### [${id}] 🟠 ${hecha ? '✅ [HECHA 31/07] ' : '[ABIERTO 31/07] '}Título de ${id}\n\n- ${'x'.repeat(n)}\n`

function escribirFicha(id, contenido) {
  fs.mkdirSync(path.join(trabajo, DIR), { recursive: true })
  fs.writeFileSync(path.join(trabajo, DIR, `${id}.md`), contenido)
}
function borrarFicha(id) {
  fs.unlinkSync(path.join(trabajo, DIR, `${id}.md`))
}
function commit(mensaje) {
  git(trabajo, ['add', '-A'])
  git(trabajo, ['commit', '-q', '-m', mensaje])
}
function correrGuard(env = {}) {
  try {
    const salida = execFileSync(process.execPath, [BRIDGE], {
      cwd: trabajo,
      encoding: 'utf8',
      env: { ...process.env, CONTEXTO_GUARD_REPO: trabajo, DATABASE_URL: '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, salida }
  } catch (e) {
    return { code: e.status, salida: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

let fallos = 0
function caso(n, titulo, esperado, obtenido, salida) {
  const ok = esperado === obtenido.code
  console.log(`\n${n}) ${titulo}`)
  console.log(`   ${ok ? '✅' : '❌'} ${ok ? 'como se esperaba' : 'FALLO'} (esperado exit ${esperado}, obtenido ${obtenido.code})`)
  if (salida !== false) console.log('      ' + obtenido.salida.trim().split('\n').slice(0, 3).join('\n      '))
  if (!ok) fallos++
}

;(function main() {
  console.log('══ SIMULACIÓN del guardarraíl (T-532: una ficha = un fichero) ══════════════════')
  console.log(`   repo de pruebas: ${trabajo}`)

  git(raiz, ['init', '--bare', '-q', '-b', 'main', remoto])
  fs.mkdirSync(trabajo, { recursive: true })
  git(trabajo, ['init', '-q', '-b', 'main'])
  git(trabajo, ['config', 'user.email', 'sim@vence.test'])
  git(trabajo, ['config', 'user.name', 'sim'])
  git(trabajo, ['remote', 'add', 'origin', remoto])

  escribirFicha('T-100', ficha('T-100', 400))
  escribirFicha('T-101', ficha('T-101', 400))
  commit('docs: dos fichas base')
  git(trabajo, ['push', '-q', 'origin', 'main'])
  git(trabajo, ['fetch', '-q', 'origin', 'main'])

  caso(1, 'En reposo, sin cambios sobre lo publicado', 0, correrGuard())

  escribirFicha('T-100', ficha('T-100', 400) + '- más contexto que se AÑADE\n')
  commit('docs(T-100): amplío el contexto')
  caso(2, 'Una sesión AMPLÍA una ficha (uso normal)', 0, correrGuard())
  git(trabajo, ['push', '-q', 'origin', 'main'])
  git(trabajo, ['fetch', '-q', 'origin', 'main'])

  borrarFicha('T-101')
  commit('feat: cambio cualquiera que de paso borra el fichero de T-101')
  caso(3, 'EL INCIDENTE — el push borra el FICHERO de otra ficha', 1, correrGuard())

  caso(4, 'El borrado es a propósito y se usa el escape', 0, correrGuard({ CONTEXTO_GUARD_SKIP: '1' }))

  // Deshacer el borrado antes del siguiente caso (cada caso parte de HEAD limpio).
  git(trabajo, ['reset', '-q', '--hard', 'origin/main'])

  // El suelo (MIN_CHARS_PERDIDOS=600) y la fracción (RATIO_MERMA=0.5) tienen que cruzarse LOS DOS:
  // 400→100 solo pierde 300 caracteres y no dispara. Aquí se parte de una ficha grande a propósito.
  escribirFicha('T-100', ficha('T-100', 3000))
  commit('docs(T-100): ficha grande, para poder vaciarla de verdad')
  git(trabajo, ['push', '-q', 'origin', 'main'])
  git(trabajo, ['fetch', '-q', 'origin', 'main'])

  escribirFicha('T-100', ficha('T-100', 100))
  commit('feat: vacía T-100 sin cerrarla')
  caso(5, 'La ficha sigue, pero su FICHERO se vacía de contexto', 1, correrGuard())
  git(trabajo, ['reset', '-q', '--hard', 'origin/main'])

  escribirFicha('T-100', ficha('T-100', 100, true))
  commit('docs(T-100): cerrada y condensada')
  caso(6, 'Se CIERRA una ficha y se condensa (flujo normal)', 0, correrGuard())
  git(trabajo, ['reset', '-q', '--hard', 'origin/main'])

  fs.writeFileSync(path.join(trabajo, 'README-sim.md'), 'algo ajeno\n')
  commit('chore: un cambio que no toca ninguna ficha')
  caso(7, 'Un push que NO toca docs/roadmap/tareas/', 0, correrGuard())

  console.log('\n' + '═'.repeat(74))
  if (fallos) { console.log(`❌ ${fallos} caso(s) fallaron`); process.exitCode = 1 }
  else console.log('✅ SIMULACIÓN VERDE — 7/7 casos')

  if (!CONSERVAR) fs.rmSync(raiz, { recursive: true, force: true })
  else console.log(`\n(conservado en ${raiz})`)
})()
