#!/usr/bin/env node
'use strict'
/**
 * Guard del PRE-COMMIT: no dejes ir al índice texto que ninguna ficha produce. (T-721)
 *
 * `indiceEstaAlDia()` existía desde [T-532] y solo fallaba en CI — tarde, y sin decir qué hacer.
 * Esto lo adelanta al momento en que aún se puede rescatar el texto, y sobre todo EXPLICA: dice
 * de qué fichas es lo que se va a perder y cómo llevarlo a su sitio.
 *
 * Solo opina si `docs/roadmap/tareas-pendientes.md` está en el commit. FAIL-OPEN: sin el
 * directorio de fichas, o si algo revienta, deja pasar — un guard que no puede medir no acusa.
 *
 * Escape (para cuando de verdad toque):  INDICE_GUARD_SKIP="por qué" git commit …
 */
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.resolve(__dirname, '..', '..')
const INDICE = 'docs/roadmap/tareas-pendientes.md'

function main() {
  const motivo = process.env.INDICE_GUARD_SKIP
  if (motivo) {
    console.log(`⏭️  indice-huerfano-guard saltado: ${motivo}`)
    return 0
  }

  let staged = ''
  try {
    staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: REPO, encoding: 'utf8' })
  } catch { return 0 }
  if (!staged.split('\n').map((s) => s.trim()).includes(INDICE)) return 0

  let FD, HUE, fs
  try {
    FD = require(path.join(REPO, 'lib', 'backlog', 'fichasDir.cjs'))
    HUE = require(path.join(REPO, 'lib', 'backlog', 'indiceHuerfano.cjs'))
    fs = require('fs')
  } catch { return 0 }

  let comiteado, generado
  try {
    comiteado = fs.readFileSync(path.join(REPO, INDICE), 'utf8')
    generado = FD.generarIndice()
  } catch { return 0 }                       // sin poder generar no se acusa

  const { alDia, huerfanas, total } = HUE.lineasHuerfanas(comiteado, generado)
  if (alDia) return 0

  const fichas = HUE.fichasAfectadas(huerfanas)
  console.error('')
  console.error('❌ El índice del backlog trae texto que NINGUNA ficha produce.')
  console.error(`   ${total} línea(s) se perderían en la próxima regeneración, sin ruido.`)
  console.error('')
  console.error('   Desde T-532 la fuente es docs/roadmap/tareas/T-nnn.md y el índice se GENERA.')
  console.error('   Esto pasa al mergear una rama anterior a ese cambio: su texto entra en el')
  console.error('   índice (a veces SIN conflicto, que es el caso traicionero) y ahí se queda')
  console.error('   hasta que alguien regenera y lo borra.')
  console.error('')
  if (fichas.length) {
    console.error(`   Fichas afectadas: ${fichas.join(', ')}`)
    console.error('   Lleva ese texto a su fichero y regenera:')
    for (const id of fichas.slice(0, 5)) console.error(`     · docs/roadmap/tareas/${id}.md`)
    console.error('     node -e "require(\'./lib/backlog/fichasDir.cjs\').regenerarIndice()"')
  } else {
    console.error('   No lleva cabecera de ficha reconocible — míralo a mano antes de seguir.')
  }
  console.error('')
  console.error('   Muestra de lo que se perdería:')
  for (const l of huerfanas.slice(0, 6)) console.error(`     ${l.slice(0, 110)}`)
  if (total > 6) console.error(`     … y ${total - 6} línea(s) más`)
  console.error('')
  console.error('   Si de verdad toca (p. ej. estás rehaciendo el índice a propósito):')
  console.error('     INDICE_GUARD_SKIP="por qué" git commit …')
  return 1
}

process.exit(main())
