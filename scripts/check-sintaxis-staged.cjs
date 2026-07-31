#!/usr/bin/env node
// scripts/check-sintaxis-staged.cjs — bridge del check de sintaxis (lo invoca .husky/pre-commit).
//
// Reúne el input real (ficheros staged), pasa cada uno por `node --check` y decide con la lógica
// PURA de lib/calidad/sintaxisStaged.cjs. El porqué —y por qué el JSX solo avisa— está allí.
//
// Filosofía de fallo:
//   · FAIL-CLOSED en lo único que existe para cazar: un fichero staged que NO parsea → exit 1.
//     Dejarlo pasar pone `main` en rojo y con él el deploy de todas las sesiones.
//   · FAIL-OPEN ante problemas de infra (no es un repo git, `git` no responde): exit 0 en silencio.
//   · Cortocircuito: sin ficheros comprobables, ni arranca (un commit de docs no paga peaje).
//
// Escape: SINTAXIS_CHECK_SKIP=1 (queda impreso). Es preferible a `--no-verify`, que apaga además
// el db:check, el audit:display-drift y los tests.

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { ficherosAComprobar, clasificar } = require('../lib/calidad/sintaxisStaged.cjs')

const REPO = path.join(__dirname, '..')

if (process.env.SINTAXIS_CHECK_SKIP === '1') {
  console.log('⏭️  Check de sintaxis saltado (SINTAXIS_CHECK_SKIP=1).')
  process.exit(0)
}

/** Ficheros staged que se van a commitear (añadidos, copiados, modificados: los borrados no). */
function staged() {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      cwd: REPO, encoding: 'utf8',
    })
    return out.split('\n')
  } catch {
    return [] // fail-open: sin git no hay nada que juzgar
  }
}

const rutas = ficherosAComprobar(staged())
if (rutas.length === 0) process.exit(0)

const resultados = rutas.map((ruta) => {
  const abs = path.join(REPO, ruta)
  let contenido = ''
  try { contenido = fs.readFileSync(abs, 'utf8') } catch { return { ruta, ok: true, error: null, contenido: '' } }
  try {
    execFileSync(process.execPath, ['--check', abs], { encoding: 'utf8', stdio: 'pipe' })
    return { ruta, ok: true, error: null, contenido }
  } catch (e) {
    const salida = String(e.stderr || e.stdout || e.message || '')
    // Del volcado de node interesa la línea del SyntaxError y la del fichero:línea.
    const error = salida.split('\n').filter((l) => /SyntaxError|^\/|:\d+$/.test(l)).slice(0, 3).join(' · ')
    return { ruta, ok: false, error: error || salida.slice(0, 200), contenido }
  }
})

const { rotos, avisos, ok, bloquea } = clasificar(resultados)

for (const a of avisos) {
  console.log(`⚠️  ${a.ruta}: no parsea con \`node --check\`, pero tiene pinta de JSX (que node no entiende). No bloquea.`)
}

if (!bloquea) {
  console.log(`✅ Sintaxis OK en ${ok} fichero(s) staged.`)
  process.exit(0)
}

console.log('')
console.log('❌ ERROR DE SINTAXIS en ficheros que estás a punto de commitear:')
console.log('')
for (const r of rotos) {
  console.log(`   · ${r.ruta}`)
  console.log(`     ${r.error}`)
}
console.log('')
console.log('   Si esto llega a `main`, el CI se pone rojo y NINGUNA sesión puede desplegar')
console.log('   hasta que alguien lo note. Por eso se para aquí y no allí.')
console.log('')
console.log('   Sospechoso habitual: backticks de markdown dentro de un template literal')
console.log('   (`-- comentario SQL con `identificador``) — cierran la plantilla.')
console.log('')
console.log('   Compruébalo tú mismo con:  node --check <fichero>')
console.log('   Escape (déjalo para cuando de verdad toque):  SINTAXIS_CHECK_SKIP=1 git commit …')
console.log('')
process.exit(1)
