#!/usr/bin/env node
/**
 * scripts/hooks/sim-candado-typecheck.cjs — ¿el candado SERIALIZA de verdad? (T-682)
 *
 * ── POR QUÉ ESTA SIMULACIÓN Y NO SOLO LOS UNITARIOS ─────────────────────────────────────────
 * Los tests de `candadoTypecheck` comprueban que se construye bien la línea de órdenes: eso es
 * TEXTO. Que dos procesos de verdad no se solapen depende de `flock`, del sistema de ficheros y
 * de los permisos entre usuarios distintos — nada de lo cual se ve leyendo código. Es la regla de
 * la casa: un guardarraíl de texto no es una ejecución.
 *
 * Y el fallo que se busca es de los silenciosos: si el candado no agarra, todo «funciona» —los
 * typechecks corren, los pushes pasan— y lo único que ocurre es que la máquina se vuelve a ahogar
 * dentro de unos días, sin que nada lo relacione con esto.
 *
 * ── QUÉ HACE ─────────────────────────────────────────────────────────────────────────────────
 * Lanza N procesos A LA VEZ, cada uno envuelto por `conCandado` con un comando que solo escribe
 * cuándo entra y cuándo sale. Después mira los intervalos: si alguno se solapa con otro, el
 * candado NO sirve. Comprueba además el fail-open (espera agotada → se corre igual) y que la
 * ausencia de `flock` no impida nada.
 *
 * Uso:  node scripts/hooks/sim-candado-typecheck.cjs [--n 4]
 */
'use strict'
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { conCandado, interpretarSalida, SALIDA_SIN_CANDADO } = require('../../lib/hooks/candadoTypecheck.cjs')

const N = Number((process.argv.find((a) => a.startsWith('--n=')) || '').split('=')[1] || 4)
const hayFlock = spawnSync('sh', ['-c', 'command -v flock'], { stdio: 'ignore' }).status === 0
let fallos = 0

const bien = (m) => console.log('   ✅', m)
const mal = (m) => { fallos++; console.log('   ❌', m) }

/** Un "typecheck" de mentira: apunta entrada y salida con marca de tiempo. Dura ~700 ms. */
function trabajo(registro, id) {
  return ['sh', ['-c', `echo "IN ${id} $(date +%s%N)" >> ${registro}; sleep 0.7; echo "OUT ${id} $(date +%s%N)" >> ${registro}`]]
}

async function main() {
  console.log(`\n🔒 SIMULACIÓN del candado del typecheck — ${N} a la vez\n`)
  if (!hayFlock) {
    console.log('⚠️  esta máquina no tiene `flock`: solo se puede comprobar el camino sin candado.\n')
  }

  // ── 1. ¿SERIALIZA? ────────────────────────────────────────────────────────────────────────
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-candado-'))
  const registro = path.join(dir, 'marcas.txt')
  const ruta = path.join(dir, 'prueba.lock')   // candado propio: no se toca el de la máquina
  fs.writeFileSync(registro, '')

  console.log(`1. ${N} procesos simultáneos, cada uno tarda ~0,7 s`)
  await Promise.all(Array.from({ length: N }, (_, i) => new Promise((res) => {
    const [cmd, args] = trabajo(registro, i)
    const inv = conCandado({ comando: cmd, args, esperaMaxSegundos: 60, hayFlock, ruta })
    spawn(inv.comando, inv.args, { stdio: 'ignore' }).on('exit', res)
  })))

  const marcas = fs.readFileSync(registro, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => { const [t, id, ns] = l.split(' '); return { t, id, ms: Number(BigInt(ns) / 1000000n) } })
  const tramos = marcas.filter((m) => m.t === 'IN').map((inM) => {
    const out = marcas.find((m) => m.t === 'OUT' && m.id === inM.id)
    return { id: inM.id, ini: inM.ms, fin: out ? out.ms : Infinity }
  }).sort((a, b) => a.ini - b.ini)

  if (tramos.length !== N) mal(`esperaba ${N} tramos y hay ${tramos.length}: algún proceso no corrió`)
  const solapes = []
  for (let i = 0; i < tramos.length - 1; i++) {
    if (tramos[i + 1].ini < tramos[i].fin) solapes.push(`${tramos[i].id}↔${tramos[i + 1].id}`)
  }
  const total = tramos.length ? tramos[tramos.length - 1].fin - tramos[0].ini : 0

  if (hayFlock) {
    if (solapes.length) mal(`SE SOLAPAN (${solapes.join(', ')}): el candado no agarra`)
    else bien(`ninguno se solapa · ${N} tramos en serie, ${total} ms en total (≈${N} × 700 ms)`)
    // Si de verdad van en serie el total tiene que acercarse a N×700, no a 700.
    if (total < 700 * N * 0.8) mal(`el total (${total} ms) es demasiado corto para ${N} en serie: sospechoso`)
    else bien(`la duración total confirma la serie (no corrieron en paralelo)`)
  } else {
    bien('sin `flock`: no se exige serialización (comprobado que aun así corren todos)')
  }
  fs.rmSync(dir, { recursive: true, force: true })

  // ── 2. FAIL-OPEN: espera agotada → se corre igual ─────────────────────────────────────────
  console.log('\n2. Con el candado ocupado y la espera a 0, ¿avisa en vez de fallar como si fuesen tipos?')
  if (hayFlock) {
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-candado2-'))
    const ruta2 = path.join(dir2, 'ocupado.lock')
    const ocupante = spawn('flock', [ruta2, 'sleep', '3'], { stdio: 'ignore' })
    await new Promise((r) => setTimeout(r, 300))
    const inv = conCandado({ comando: 'true', args: [], esperaMaxSegundos: 0, hayFlock, ruta: ruta2 })
    const r = spawnSync(inv.comando, inv.args, { stdio: 'ignore' })
    const v = interpretarSalida(r.status, { conCandado: inv.conCandado })
    if (v === 'sin_candado') bien(`espera agotada → «${v}» (código ${SALIDA_SIN_CANDADO}), distinguible de un fallo de tipos`)
    else mal(`esperaba «sin_candado» y salió «${v}» (código ${r.status}): un push se bloquearía creyendo que fallan los tipos`)
    ocupante.kill()
    fs.rmSync(dir2, { recursive: true, force: true })
  } else {
    console.log('   ⏭️  sin `flock`, no aplica')
  }

  // ── 3. El código del comando llega intacto ────────────────────────────────────────────────
  console.log('\n3. ¿Un fallo REAL del comando sigue llegando como fallo?')
  const invF = conCandado({ comando: 'sh', args: ['-c', 'exit 2'], esperaMaxSegundos: 30, hayFlock })
  const rf = spawnSync(invF.comando, invF.args, { stdio: 'ignore' })
  if (interpretarSalida(rf.status, { conCandado: invF.conCandado }) === 'fallo') bien('sí: el candado no se come el error')
  else mal(`el fallo del comando se perdió (código ${rf.status}) — el guard dejaría pasar tipos rotos`)

  console.log(fallos ? `\n❌ ${fallos} comprobación(es) fallidas\n` : '\n✅ el candado serializa, avisa cuando no puede y no se come los fallos\n')
  process.exit(fallos ? 1 : 0)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
