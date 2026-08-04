#!/usr/bin/env node
/**
 * sim-indice-parcial.cjs — ¿de verdad un commit parcial no arrastra lo de la otra sesión? (T-486)
 *
 * ── QUÉ PRUEBA, Y POR QUÉ NO BASTAN LOS UNIT ────────────────────────────────────────────────
 * La exención que introduce [T-486] descansa ENTERA sobre una afirmación acerca de git: que
 * `git commit -- <rutas>` construye un índice temporal propio y por eso no puede llevarse lo que
 * otra sesión dejó preparado en el índice compartido. Los tests unitarios comprueban que sabemos
 * LEER el nombre de ese índice; no pueden comprobar que git haga lo que creemos.
 *
 * Y creerlo de más sería grave en las dos direcciones:
 *   · si el commit parcial SÍ arrastrase lo ajeno, habríamos abierto el agujero de [T-415] —el
 *     trabajo de una sesión acabando en main bajo el mensaje de otra— con la bendición del hook;
 *   · `git commit -a` **también** trae un índice distinto (`index.lock`) y sí barre lo ajeno, así
 *     que la regla cómoda «índice distinto → deja pasar» sería exactamente el agujero.
 *
 * Por eso aquí se monta un repo de verdad, se reproduce el choque de dos sesiones y se compara el
 * VEREDICTO del detector con lo que git acaba metiendo en el commit. Si una versión futura de git
 * renombra su índice temporal o cambia de comportamiento, esto se pone rojo el día que pase.
 *
 * No toca la BD, no toca el repo de trabajo y no necesita red: repos desechables en un temporal.
 *
 * Uso:  npm run sim:indice-parcial       (o: node scripts/sim/sim-indice-parcial.cjs)
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.resolve(__dirname, '..', '..')
const { esCommitParcial } = require(path.join(REPO, 'lib', 'sessions', 'indiceCompartido.cjs'))

const casos = []
function afirmar(nombre, ok, detalle = '') {
  casos.push({ nombre, ok })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`)
}

const git = (cwd, args, env = {}) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/**
 * Monta un repo con el choque de [T-415] ya preparado:
 * la sesión AJENA ha hecho `git add ajeno.txt`, y yo tengo mi `mio.txt` modificado sin preparar.
 */
function repoConChoque() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vence-sim-indice-'))
  git(dir, ['init', '-q', '.'])
  git(dir, ['config', 'user.email', 'sim@vence'])
  git(dir, ['config', 'user.name', 'sim'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  fs.writeFileSync(path.join(dir, 'mio.txt'), 'v1\n')
  fs.writeFileSync(path.join(dir, 'ajeno.txt'), 'v1\n')
  git(dir, ['add', '.'])
  git(dir, ['commit', '-qm', 'base'])

  // Las dos sesiones tocan su fichero; la AJENA además lo prepara en el índice COMPARTIDO.
  fs.writeFileSync(path.join(dir, 'mio.txt'), 'v2-mio\n')
  fs.writeFileSync(path.join(dir, 'ajeno.txt'), 'v2-ajeno\n')
  git(dir, ['add', 'ajeno.txt'])

  // Un hook que solo ANOTA qué índice le ha dado git: es el dato que lee el guardarraíl real.
  const hooks = path.join(dir, '.git', 'hooks')
  fs.mkdirSync(hooks, { recursive: true })
  const marca = path.join(dir, 'indice-visto.txt')
  fs.writeFileSync(path.join(hooks, 'pre-commit'),
    `#!/bin/sh\nprintf '%s' "\${GIT_INDEX_FILE:-}" > ${JSON.stringify(marca)}\n`)
  fs.chmodSync(path.join(hooks, 'pre-commit'), 0o755)
  return { dir, marca }
}

/** Corre una forma de commit y devuelve qué vio el hook y qué acabó DENTRO del commit. */
function medir(argsCommit) {
  const { dir, marca } = repoConChoque()
  try {
    git(dir, ['commit', '-q', '-m', 'sim', ...argsCommit])
    const indiceVisto = fs.existsSync(marca) ? fs.readFileSync(marca, 'utf8') : ''
    const ficheros = git(dir, ['show', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean)
    return { indiceVisto, ficheros, arrastraAjeno: ficheros.includes('ajeno.txt') }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  console.log('\nSIMULACIÓN — el commit parcial contra el índice compartido (T-486)')
  console.log('='.repeat(70))
  console.log('Escenario en los tres casos: otra sesión ha hecho `git add ajeno.txt` en MI directorio.\n')

  const FORMAS = [
    { etq: 'commit NORMAL      (git commit -m …)', args: [], eximir: false },
    { etq: 'commit -a          (git commit -am …)', args: ['-a'], eximir: false },
    { etq: 'commit PARCIAL     (git commit -m … -- mio.txt)', args: ['--', 'mio.txt'], eximir: true },
  ]

  for (const f of FORMAS) {
    const m = medir(f.args)
    const detector = esCommitParcial(m.indiceVisto)
    console.log(`▸ ${f.etq}`)
    console.log(`     índice que ve el hook : ${path.basename(m.indiceVisto) || '<vacío>'}`)
    console.log(`     entra en el commit    : ${m.ficheros.join(', ') || '<nada>'}`)

    // 1. LA VERDAD MEDIDA: ¿se lleva el fichero de la otra sesión?
    afirmar(
      f.eximir ? 'NO se lleva el fichero de la otra sesión' : 'se lleva el fichero ajeno (el fallo de T-415, reproducido)',
      m.arrastraAjeno === !f.eximir,
      `ajeno.txt ${m.arrastraAjeno ? 'DENTRO' : 'fuera'}`,
    )

    // 2. Y lo que de verdad decide: que el detector coincida con esa verdad, no con una teoría.
    afirmar(
      `el detector dice «${f.eximir ? 'exento' : 'bloquea'}» y coincide con lo medido`,
      detector === f.eximir,
      `esCommitParcial=${detector}`,
    )
    console.log('')
  }

  // El caso que hace que la regla ESTRECHA valga la pena: `-a` trae índice distinto del normal, y
  // si el criterio fuese «distinto del normal → deja pasar», se colaría arrastrando lo ajeno.
  const a = medir(['-a'])
  afirmar(
    '`-a` trae un índice DISTINTO del normal y aun así arrastra: por eso el corte no puede ser «índice distinto»',
    path.basename(a.indiceVisto) !== 'index' && a.arrastraAjeno,
    path.basename(a.indiceVisto),
  )

  const fallos = casos.filter((c) => !c.ok)
  console.log(`\n${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} comprobaciones`)
  if (fallos.length) console.log('   ' + fallos.map((f) => f.nombre).join('\n   '))
  return fallos.length ? 1 : 0
}

try {
  process.exit(main())
} catch (e) {
  console.error('❌ la simulación no pudo correr:', String((e && e.message) || e).slice(0, 300))
  process.exit(1)
}
