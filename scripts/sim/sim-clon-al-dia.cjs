#!/usr/bin/env node
/**
 * sim-clon-al-dia.cjs — la puerta del clon, contra repos git DE VERDAD. (T-486)
 *
 * ── POR QUÉ NO BASTAN LOS TESTS ─────────────────────────────────────────────────────────────
 * Los unitarios comprueban el JUICIO: dada una sonda, ¿se encarga o no? Lo que no pueden ver es si
 * la sonda **llega entera a la máquina y dice la verdad**, que es donde estuvo el fallo real: con
 * `JSON.stringify` (comillas dobles) el shell de fuera expandía los `$(…)` ANTES de llegar al
 * repo, así que `git rev-parse` corría en otro directorio y la sonda reportaba «no hay clon» de una
 * máquina que lo tenía. Un test con cadenas no lo habría notado nunca: la cadena era correcta.
 *
 * Aquí se monta un remoto y un clon reales, se pone el clon en cada uno de los estados que la
 * puerta distingue, y se ejecuta la MISMA orden con el MISMO citado que usa el supervisor. Si una
 * versión futura de git cambia lo que imprime, esto se pone rojo ese día.
 *
 * No toca la red, ni la BD, ni ninguna máquina de la flota: todo en un directorio temporal.
 *
 * Uso:  npm run sim:clon-al-dia
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ACT = require(path.join(__dirname, '..', '..', 'lib', 'flota', 'actualizacion.cjs'))

// El MISMO citado que el supervisor. Si allí cambia y aquí no, el sim deja de probar lo que cree.
const citar = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

const casos = []
function afirmar(nombre, ok, detalle = '') {
  casos.push({ nombre, ok })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`)
}

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/** Ejecuta la sonda como la ejecuta el supervisor: `bash -c "<citado>"`, con el shell por medio. */
function sondar(arbol) {
  const orden = `bash -lc ${citar(ACT.SONDA_GIT(arbol))}`
  let salida = ''
  try {
    salida = execFileSync('bash', ['-c', orden], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) { salida = String((e && e.stdout) || '') }
  return ACT.evaluarClon(ACT.leerSonda(salida))
}

function main() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-clon-'))
  const remoto = path.join(base, 'remoto')
  const clon = path.join(base, 'clon')

  console.log('\nSIMULACIÓN — la puerta del clon, con repos git reales (T-486)')
  console.log('='.repeat(66))
  try {
    // ── un remoto con historia ──────────────────────────────────────────────────────────
    fs.mkdirSync(remoto)
    git(remoto, 'init', '-q', '-b', 'main')
    git(remoto, 'config', 'user.email', 'sim@vence.local')
    git(remoto, 'config', 'user.name', 'sim')
    fs.writeFileSync(path.join(remoto, 'a.txt'), 'uno\n')
    git(remoto, 'add', '-A'); git(remoto, 'commit', '-q', '-m', 'uno')
    execFileSync('git', ['clone', '-q', remoto, clon], { stdio: ['ignore', 'pipe', 'pipe'] })
    git(clon, 'config', 'user.email', 'sim@vence.local')
    git(clon, 'config', 'user.name', 'sim')

    console.log('\n▸ al día')
    afirmar('un clon recién hecho está al día', sondar(clon).estado === 'al_dia')

    console.log('\n▸ atrasado: el caso que motivó todo esto')
    // Dos commits nuevos en el remoto = lo que le pasó a w1, que iba 30 por detrás.
    for (const n of ['dos', 'tres']) {
      fs.writeFileSync(path.join(remoto, 'a.txt'), `${n}\n`)
      git(remoto, 'add', '-A'); git(remoto, 'commit', '-q', '-m', n)
    }
    const atrasado = sondar(clon)
    afirmar('detecta el retraso', atrasado.estado === 'atrasado', atrasado.motivo)
    afirmar('y aun así deja encargar (se actualiza antes)', atrasado.puedeEncargar === true)
    // Y el arreglo de verdad: ¿el pull lo deja al día?
    execFileSync('bash', ['-c', `bash -lc ${citar(ACT.ORDEN_ACTUALIZAR(clon))}`], { stdio: ['ignore', 'pipe', 'pipe'] })
    afirmar('tras actualizar, queda al día', sondar(clon).estado === 'al_dia')
    afirmar('y el contenido es el del remoto', fs.readFileSync(path.join(clon, 'a.txt'), 'utf8').trim() === 'tres')

    console.log('\n▸ lo que NO se toca: trabajo que puede no estar en ningún otro sitio')
    fs.writeFileSync(path.join(clon, 'a.txt'), 'trabajo a medias\n')
    const sucio = sondar(clon)
    afirmar('árbol sucio → no se encarga', sucio.estado === 'sucio' && !sucio.puedeEncargar, sucio.motivo)
    afirmar('y NO se ha tocado el fichero',
      fs.readFileSync(path.join(clon, 'a.txt'), 'utf8').trim() === 'trabajo a medias')

    git(clon, 'checkout', '-q', '--', 'a.txt')
    fs.writeFileSync(path.join(clon, 'b.txt'), 'suyo\n')
    git(clon, 'add', '-A'); git(clon, 'commit', '-q', '-m', 'local sin empujar')
    const adelantado = sondar(clon)
    afirmar('commits sin empujar → no se encarga', adelantado.estado === 'adelantado' && !adelantado.puedeEncargar)
    afirmar('y el commit sigue ahí', git(clon, 'log', '--oneline', '-1').includes('local sin empujar'))

    console.log('\n▸ un remoto que no responde: no saber NO es estar al día')
    git(clon, 'remote', 'set-url', 'origin', path.join(base, 'no-existe'))
    const sinRed = sondar(clon)
    afirmar('sin poder consultar origin → no se encarga', !sinRed.puedeEncargar, sinRed.estado)

    console.log('\n▸ y donde no hay repo')
    afirmar('directorio sin clon → no se encarga', sondar(path.join(base, 'vacio')).estado === 'sin_repo')

    // ── LO QUE ROMPIÓ DE VERDAD ─────────────────────────────────────────────────────────
    // El citado. Con comillas dobles, el `$(git rev-parse …)` lo ejecuta el shell de FUERA, en su
    // directorio, y la sonda miente sobre una máquina perfectamente sana.
    console.log('\n▸ el citado: la sonda tiene que llegar INTACTA al otro lado')
    git(clon, 'remote', 'set-url', 'origin', remoto)    // sano otra vez, para medir solo el citado
    const suyo = git(clon, 'rev-parse', '--short', 'HEAD')

    const leerHead = (orden) => {
      let s = ''
      try { s = execFileSync('bash', ['-c', orden], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
      catch (e) { s = String((e && e.stdout) || '') }
      return ACT.leerSonda(s).head
    }
    // Con comillas simples, la sonda habla del clon.
    afirmar('con comillas simples la sonda habla del clon',
      leerHead(`bash -lc ${citar(ACT.SONDA_GIT(clon))}`) === suyo, suyo)
    // Con dobles, el `$(git rev-parse …)` lo ejecuta el shell de FUERA, en SU directorio: la sonda
    // acaba describiendo otro repo (o ninguno) y miente sobre una máquina perfectamente sana.
    const conDobles = leerHead(`bash -lc ${JSON.stringify(ACT.SONDA_GIT(clon))}`)
    afirmar('con comillas dobles describe OTRO repo (por eso no se usan)',
      conDobles !== suyo, `dobles→${conDobles || '(nada)'} · real→${suyo}`)
  } catch (e) {
    console.error(`\n❌ la simulación no pudo completarse: ${String((e && e.message) || e).slice(0, 200)}`)
    casos.push({ nombre: 'ejecución completa', ok: false })
  } finally {
    try { fs.rmSync(base, { recursive: true, force: true }) } catch {}
  }

  const fallos = casos.filter((c) => !c.ok)
  console.log(`\n${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} comprobaciones`)
  if (fallos.length) console.log('   ' + fallos.map((f) => f.nombre).join('\n   '))
  return fallos.length ? 1 : 0
}

process.exit(main())
