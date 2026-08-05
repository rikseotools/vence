#!/usr/bin/env node
/**
 * EJECUTA el rescate de la flota contra repos git de verdad.  →  npm run sim:rescate-flota
 *
 * POR QUÉ EXISTE
 * Los tests de `__tests__/flota/encargo.test.ts` comprueban el TEXTO de la orden con expresiones
 * regulares: que mencione `git push`, que no mencione `reset`. Eso demuestra lo que la orden DICE.
 * Lo que hace —si el trabajo llega de verdad al remoto, si el mensaje de commit sale en varias
 * líneas o con los `\n` literales, si una rama ya divergida la hace fracasar— solo lo demuestra
 * ejecutarla. Un guardarraíl de texto no es una ejecución.
 *
 * Y ejecuta la orden REAL (`lib/flota/rescate.cjs`), no una reconstrucción: si alguien la cambia,
 * esto cambia con ella o falla. Una simulación que reconstruye lo que prueba, prueba una copia.
 *
 * No toca nada de producción: repos bare + clones en un directorio temporal que se borra al salir.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')
const { ordenRescate } = require(path.join(__dirname, '..', '..', 'lib', 'flota', 'rescate.cjs'))

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-rescate-'))
process.on('exit', () => { try { fs.rmSync(BASE, { recursive: true, force: true }) } catch {} })

const ENTORNO = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Sim', GIT_AUTHOR_EMAIL: 'sim@vence.local',
  GIT_COMMITTER_NAME: 'Sim', GIT_COMMITTER_EMAIL: 'sim@vence.local',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
}
const sh = (cmd, cwd) =>
  execSync(cmd, { cwd, env: ENTORNO, stdio: ['ignore', 'pipe', 'pipe'], shell: '/bin/bash' }).toString()
const shTolerante = (cmd, cwd) => {
  try { return { salida: sh(cmd, cwd), codigo: 0 } }
  catch (e) { return { salida: String(e.stdout || '') + String(e.stderr || ''), codigo: e.status } }
}

let fallos = 0
const ok = (m) => console.log(`  ✅ ${m}`)
const mal = (m) => { console.log(`  ❌ ${m}`); fallos++ }
const comprobar = (cond, siBien, siMal) => (cond ? ok(siBien) : mal(siMal || siBien))

/** Un origin bare + un clon con un commit base. Devuelve {origen, arbol}. */
function repo(nombre) {
  const origen = path.join(BASE, `${nombre}.git`)
  const arbol = path.join(BASE, nombre)
  sh(`git init -q --bare "${origen}"`)
  sh(`git init -q -b main "${arbol}" && git -C "${arbol}" remote add origin "${origen}"`)
  fs.writeFileSync(path.join(arbol, 'f.txt'), 'base\n')
  sh('git add -A && git commit -q -m base && git push -q origin main && git fetch -q origin', arbol)
  return { origen, arbol }
}
/** Ejecuta la orden REAL de producción sobre un árbol. */
const rescatar = (arbol, w = 'sim') =>
  shTolerante(ordenRescate({ arbol, trabajador: w, conGuardas: false }))
const ramaDe = (salida) => (salida.match(/^RAMA=(.+)$/m) || [])[1]

console.log('\n🔁 sim:rescate-flota — ejecutando la orden real contra repos git desechables\n')

// ── 1. Cambios SIN COMMITEAR: el caso que deja encallado al trabajador ────────────────────────
console.log('── 1. trabajo sin commitear (la única copia)')
{
  const { origen, arbol } = repo('c1')
  fs.writeFileSync(path.join(arbol, 'nuevo.txt'), 'trabajo que solo existe aqui\n')
  const { salida } = rescatar(arbol)
  const rama = ramaDe(salida)
  comprobar(/SALVADO=0/.test(salida), 'reporta SALVADO=0', `no reporta SALVADO=0 · ${salida.trim()}`)
  const enRemoto = shTolerante(`git -C "${origen}" show ${rama}:nuevo.txt`)
  comprobar(/solo existe/.test(enRemoto.salida), `el fichero está EN EL REMOTO (${rama})`,
    'el fichero NO llegó al remoto: el rescate no rescató nada')
  const msg = shTolerante(`git -C "${origen}" log -1 --format=%B ${rama}`).salida
  comprobar(msg.split('\n').filter(Boolean).length >= 3 && !msg.includes('\\n'),
    'el mensaje sale en varias líneas (los \\n no quedaron literales)',
    `el mensaje salió en una línea con \\n literales: ${JSON.stringify(msg.slice(0, 80))}`)
  comprobar(/sin revisar ni/.test(msg), 'el mensaje dice que NO está aprobado (rescatar ≠ aprobar)')
}

// ── 2. Idempotencia: la ref lleva el SHA, así que rescatar dos veces no duplica ────────────────
console.log('── 2. rescatar dos veces el mismo commit')
{
  const { arbol } = repo('c2')
  fs.writeFileSync(path.join(arbol, 'x.txt'), 'x\n')
  const primera = rescatar(arbol)
  const segunda = rescatar(arbol)
  comprobar(/SALVADO=0/.test(primera.salida) && /NADA/.test(segunda.salida),
    'la segunda vez dice NADA y no toca nada', `no fue idempotente · ${segunda.salida.trim()}`)
}

// ── 3. Commit local sin empujar, con el árbol limpio ──────────────────────────────────────────
console.log('── 3. commit huérfano (árbol limpio, nada en el remoto)')
{
  const { origen, arbol } = repo('c3')
  fs.writeFileSync(path.join(arbol, 'g.txt'), 'g\n')
  sh('git add -A && git commit -q -m "trabajo commiteado sin push"', arbol)
  const { salida } = rescatar(arbol)
  const rama = ramaDe(salida)
  comprobar(shTolerante(`git -C "${origen}" cat-file -e ${rama}^{commit}`).codigo === 0,
    `el commit huérfano llegó a ${rama}`, 'no se empujó el commit huérfano')
}

// ── 3.bis. EL PUNTO CIEGO REAL: el trabajo entregado NO está en HEAD ──────────────────────────
// El 05/08 el rescate dijo «nada que salvar» en las cuatro máquinas del VPS teniendo 22 commits
// sin empujar. Los trabajadores entregan en una rama por tarea (`flota/T-525-…`, `sesion/w3`) y
// luego vuelven a `main`, así que lo entregado nunca es HEAD. Miraba donde no estaba el trabajo.
console.log('── 3.bis. el trabajo entregado está en OTRA rama, no en HEAD')
{
  const { origen, arbol } = repo('c3bis')
  sh('git checkout -q -b flota/T-999-entrega', arbol)
  fs.writeFileSync(path.join(arbol, 'entrega.txt'), 'la entrega del trabajador\n')
  sh('git add -A && git commit -q -m "feat(T-999): la entrega"', arbol)
  sh('git checkout -q main', arbol) // vuelve a main, como hace el trabajador al acabar el turno
  const { salida } = rescatar(arbol)
  comprobar(!/NADA/.test(salida),
    'NO dice «nada que salvar» (era el fallo)',
    'dice NADA teniendo trabajo sin empujar: el punto ciego ha vuelto')
  const rama = (salida.match(/^RAMA=(.+)$/m) || [])[1]
  const enRemoto = shTolerante(`git -C "${origen}" show ${rama}:entrega.txt`)
  comprobar(/la entrega/.test(enRemoto.salida), `la entrega llegó al remoto (${rama})`,
    'la entrega NO llegó: el rescate sigue sin ver las ramas que no son HEAD')
  comprobar(/-flota-T-999-entrega-/.test(String(rama)),
    'el nombre de la ref dice QUÉ rama se rescató (sin barras)',
    `no se puede saber qué se rescató: ${rama}`)
}

// ── 4. Rama YA DIVERGIDA: el fallo real de l6, y la razón de no usar --force ───────────────────
console.log('── 4. la rama del trabajador ya divergió en el remoto')
{
  const { origen, arbol } = repo('c4')
  sh('git push -q origin HEAD:refs/heads/sesion/sim', arbol)
  // Otro mueve sesion/sim por delante del clon
  sh('git checkout -q -b otro', arbol)
  fs.writeFileSync(path.join(arbol, 'o.txt'), 'trabajo de OTRO\n')
  sh('git add -A && git commit -q -m "trabajo de OTRO" && git push -q origin otro:refs/heads/sesion/sim', arbol)
  sh('git checkout -q main && git branch -qD otro', arbol)
  const antes = sh(`git -C "${origen}" rev-parse refs/heads/sesion/sim`).trim()
  // La divergencia tiene que ser REAL o el caso no prueba nada
  comprobar(shTolerante(`git -C "${arbol}" merge-base --is-ancestor ${antes} HEAD`).codigo !== 0,
    'divergencia real montada (sesion/sim tiene trabajo que el clon no)',
    'NO hay divergencia: este caso no probaría nada')
  fs.writeFileSync(path.join(arbol, 'd.txt'), 'lo mio\n')
  const { salida } = rescatar(arbol)
  comprobar(/SALVADO=0/.test(salida), 'rescata igual pese a la divergencia',
    `falló con la rama divergida · ${salida.trim().slice(-160)}`)
  const despues = sh(`git -C "${origen}" rev-parse refs/heads/sesion/sim`).trim()
  comprobar(antes === despues, 'NO pisó el trabajo ajeno de sesion/sim',
    'DESTRUYÓ la rama ajena: el rescate no puede forzar jamás')
}

// ── 5. Nada que salvar ────────────────────────────────────────────────────────────────────────
console.log('── 5. no hay nada que salvar')
{
  const { arbol } = repo('c5')
  const { salida } = rescatar(arbol)
  comprobar(/NADA/.test(salida), 'dice NADA y sale sin tocar nada', `tocó algo · ${salida.trim()}`)
}

// ── 6. El árbol no existe (worktree borrado, máquina reinstalada…) ────────────────────────────
console.log('── 6. el árbol del trabajador no existe')
{
  const { codigo } = rescatar(path.join(BASE, 'no-existe'))
  comprobar(codigo === 90, 'sale con 90 sin tocar nada', `código inesperado: ${codigo}`)
}

// ── 7. Trinquete: la orden no puede aprender a destruir ───────────────────────────────────────
console.log('── 7. la orden sigue siendo puramente aditiva')
{
  const orden = ordenRescate({ arbol: '/x', trabajador: 'w1' })
  comprobar(!/reset|clean -|checkout --|stash|push .*--force|push .*-f\b/.test(orden),
    'ni reset, ni clean, ni stash, ni push forzado',
    'la orden ha aprendido a destruir: eso es de una persona, no de la máquina')
}

console.log(fallos === 0
  ? '\n✅ RESCATE VERIFICADO EJECUTÁNDOLO: 0 fallos\n'
  : `\n❌ ${fallos} fallo(s) — el rescate NO es de fiar\n`)
process.exit(fallos === 0 ? 0 : 1)
