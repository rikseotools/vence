#!/usr/bin/env node
/**
 * sim-contexto-guard.cjs — simulación de EXTREMO A EXTREMO del guardarraíl de T-428.
 *
 * Monta un repo git de usar y tirar, **reproduce el incidente real del 31/07** (dos sesiones
 * escriben en `tareas-pendientes.md`, una resuelve el conflicto quedándose con su lado) y ejecuta
 * el bridge de verdad (`scripts/contexto-push-guard.cjs`) para comprobar su CÓDIGO DE SALIDA.
 *
 * Por qué no basta con los unitarios: aquellos prueban el núcleo puro con dos cadenas de texto.
 * Aquí se prueba lo que el núcleo NO sabe y es donde se rompen estos guardarraíles — contra qué
 * commit compara, si el merge se ve, si el cortocircuito deja pasar lo que no toca el fichero, y
 * si el escape funciona. Un guard que bloquea a TODAS las sesiones no se estrena sin verlo actuar.
 *
 * No toca el repo de Vence: todo ocurre bajo un directorio temporal que se borra al salir.
 *
 * Uso:  node scripts/backlog/sim-contexto-guard.cjs [--conservar]
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const BRIDGE = path.join(__dirname, '..', 'contexto-push-guard.cjs')
const FICHERO = 'docs/roadmap/tareas-pendientes.md'
const CONSERVAR = process.argv.includes('--conservar')

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'vence-sim-contexto-'))
const remoto = path.join(raiz, 'remoto.git')
const trabajo = path.join(raiz, 'sesion')

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

/** Ficha con un cuerpo de `n` caracteres, como las reales (viñetas largas). */
const ficha = (id, n, hecha = false) =>
  `### [${id}] 🟠 ${hecha ? '✅ [HECHA 31/07] ' : '[ABIERTO 31/07] '}Título de ${id}\n\n- ${'x'.repeat(n)}\n`

function escribir(contenido) {
  fs.mkdirSync(path.join(trabajo, path.dirname(FICHERO)), { recursive: true })
  fs.writeFileSync(path.join(trabajo, FICHERO), contenido)
}

function commit(mensaje) {
  git(trabajo, ['add', '-A'])
  git(trabajo, ['commit', '-q', '-m', mensaje])
}

/** Corre el bridge contra el repo de pruebas. Devuelve { code, salida }. */
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
function comprobar(nombre, esperado, { code, salida }) {
  const ok = code === esperado
  if (!ok) fallos++
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}`)
  console.log(`      esperado exit ${esperado}, obtenido ${code}`)
  const linea = salida.split('\n').find((l) => l.trim())
  if (linea) console.log(`      ${linea.trim().slice(0, 110)}`)
}

try {
  // ── Montaje: un remoto y una sesión que ya publicó dos fichas ────────────────────────────
  fs.mkdirSync(remoto, { recursive: true })
  git(raiz, ['init', '-q', '--bare', remoto])
  git(raiz, ['clone', '-q', remoto, trabajo])
  git(trabajo, ['config', 'user.email', 'sim@vence.es'])
  git(trabajo, ['config', 'user.name', 'sim'])

  const PUBLICADO = `## Abiertas\n\n${ficha('T-100', 4000)}\n${ficha('T-101', 3000)}\n`
  escribir(PUBLICADO)
  commit('docs(backlog): dos fichas con su contexto')
  git(trabajo, ['branch', '-M', 'main'])
  git(trabajo, ['push', '-q', '--no-verify', '-u', 'origin', 'main'])

  console.log(`\n══ SIMULACIÓN del guardarraíl de pérdida de contexto (T-428) ${'═'.repeat(18)}`)
  console.log(`   repo de pruebas: ${raiz}\n`)

  // 1. Reposo: nada cambia → no opina.
  console.log('1) En reposo, sin cambios sobre lo publicado')
  comprobar('deja pasar', 0, correrGuard())

  // 2. El caso NORMAL: documentar es AMPLIAR. Jamás debe estorbar.
  console.log('\n2) Una sesión AMPLÍA una ficha (el uso normal del fichero)')
  escribir(`## Abiertas\n\n${ficha('T-100', 9000)}\n${ficha('T-101', 3000)}\n`)
  commit('docs(T-100): más contexto')
  comprobar('deja pasar', 0, correrGuard())

  // 3. EL INCIDENTE: resolver el conflicto quedándose con «su» lado borra la ficha de la otra.
  console.log('\n3) EL INCIDENTE — el push borra la ficha entera de otra sesión')
  escribir(`## Abiertas\n\n${ficha('T-100', 9000)}\n`)
  commit('docs(backlog): resolver conflicto')
  comprobar('BLOQUEA', 1, correrGuard())

  // 4. El escape propio, que es lo que evita que se use --no-verify (y se apague todo).
  console.log('\n4) El borrado es a propósito y se usa el escape')
  comprobar('deja pasar con CONTEXTO_GUARD_SKIP=1', 0, correrGuard({ CONTEXTO_GUARD_SKIP: '1' }))

  // 5. La otra mitad del incidente: la ficha sobrevive pero vaciada.
  console.log('\n5) La ficha sigue, pero vaciada de contexto')
  git(trabajo, ['reset', '-q', '--hard', 'origin/main'])
  escribir(`## Abiertas\n\n${ficha('T-100', 4000)}\n${ficha('T-101', 200)}\n`)
  commit('docs(backlog): reescribir T-101')
  comprobar('BLOQUEA', 1, correrGuard())

  // 6. Cerrar una ficha condensándola es el flujo normal: no puede bloquear.
  console.log('\n6) Se CIERRA una ficha y se condensa (flujo normal de cierre)')
  git(trabajo, ['reset', '-q', '--hard', 'origin/main'])
  escribir(`## Abiertas\n\n${ficha('T-100', 4000)}\n${ficha('T-101', 200, true)}\n`)
  commit('docs(T-101): hecha')
  comprobar('deja pasar (lo reporta como info)', 0, correrGuard())

  // 7. Cortocircuito: un push que no toca el fichero no paga peaje.
  console.log('\n7) Un push que NO toca el fichero del backlog')
  git(trabajo, ['reset', '-q', '--hard', 'origin/main'])
  fs.writeFileSync(path.join(trabajo, 'otro.txt'), 'cambio ajeno al backlog\n')
  commit('feat: algo que no es el backlog')
  comprobar('deja pasar', 0, correrGuard())

  // 8. EL CASO QUE SOLO SE VE COMPARANDO CON origin/main. La otra sesión publica DESPUÉS de que
  //    yo empezara; yo hago merge y resuelvo tirando su bloque. Mis commits nunca "borraron"
  //    nada respecto de su propio padre: comparando con el padre, esto es invisible.
  console.log('\n8) MERGE con conflicto resuelto tirando el bloque ajeno (invisible desde el padre)')
  git(trabajo, ['reset', '-q', '--hard', 'origin/main'])
  git(trabajo, ['checkout', '-q', '-b', 'mia'])
  escribir(`## Abiertas\n\n${ficha('T-100', 4000)}\n${ficha('T-101', 3000)}\n${ficha('T-102', 2500)}\n`)
  commit('docs(T-102): ficha nueva')
  // …mientras, otra sesión amplía T-101 y publica.
  const otra = path.join(raiz, 'otra')
  // `-b main` explícito: el bare nace con HEAD→master y un clon sin rama commitearía sobre una
  // rama huérfana (el push saldría «non-fast-forward» y la simulación mediría otra cosa).
  git(raiz, ['clone', '-q', '-b', 'main', remoto, otra])
  git(otra, ['config', 'user.email', 'otra@vence.es'])
  git(otra, ['config', 'user.name', 'otra'])
  fs.mkdirSync(path.join(otra, path.dirname(FICHERO)), { recursive: true })
  fs.writeFileSync(path.join(otra, FICHERO), `## Abiertas\n\n${ficha('T-100', 4000)}\n${ficha('T-101', 9000)}\n`)
  git(otra, ['add', '-A'])
  git(otra, ['commit', '-q', '-m', 'docs(T-101): traspaso completo'])
  git(otra, ['push', '-q', '--no-verify', 'origin', 'HEAD:main'])
  // Yo fusiono y resuelvo el conflicto con MI versión (T-101 corto): el bloque ajeno se pierde.
  git(trabajo, ['fetch', '-q', 'origin'])
  try { git(trabajo, ['merge', '-q', 'origin/main']) } catch { /* conflicto esperado */ }
  escribir(`## Abiertas\n\n${ficha('T-100', 4000)}\n${ficha('T-101', 3000)}\n${ficha('T-102', 2500)}\n`)
  commit('merge: resolver conflicto de tareas-pendientes')
  comprobar('BLOQUEA (el bloque ajeno se perdía en silencio)', 1, correrGuard())

  console.log(`\n${'═'.repeat(72)}`)
  console.log(fallos === 0 ? '✅ SIMULACIÓN VERDE — 8/8 casos\n' : `❌ ${fallos} caso(s) FALLIDO(s)\n`)
} finally {
  if (!CONSERVAR) fs.rmSync(raiz, { recursive: true, force: true })
  else console.log(`(repo conservado en ${raiz})`)
}

process.exit(fallos === 0 ? 0 : 1)
