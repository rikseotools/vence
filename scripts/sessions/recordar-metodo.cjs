#!/usr/bin/env node
/**
 * recordar-metodo.cjs — imprime el recordatorio de método cuando toca. (T-495, 03/08/2026)
 *
 * Lo invocan dos sitios, y los dos son MOMENTOS, no un reloj:
 *   · `.husky/pre-commit` → cuando el commit ESTRENA ficheros, que es cuando aplica «¿ya existe?»;
 *   · `backlog.cjs heartbeat` → cuando la sesión lleva rato, que es cuando el recordatorio del
 *     `claim` ya está sepultado.
 *
 * **Nunca falla hacia fuera y nunca bloquea.** Sale con 0 pase lo que pase: es un recordatorio, y
 * un recordatorio que puede tumbar un commit se acaba desactivando entero.
 *
 *   node scripts/sessions/recordar-metodo.cjs --staged      (lo que el commit añade)
 *   node scripts/sessions/recordar-metodo.cjs --minutos 120
 */
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.resolve(__dirname, '../..')
const { recordatorioPorFicherosNuevos, recordatorioPorTiempo } = require(path.join(REPO, 'lib', 'sessions', 'recordatorio.cjs'))

const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i >= 0 && v && !v.startsWith('--') ? v : null }

/** Solo los AÑADIDOS: modificar algo que ya existe no plantea la pregunta «¿ya existe?». */
function ficherosAñadidos() {
  try {
    return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=A'],
      { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 })
      .split('\n').map((s) => s.trim()).filter(Boolean)
  } catch { return [] }
}

function main() {
  const rec = process.argv.includes('--staged')
    ? recordatorioPorFicherosNuevos(ficherosAñadidos())
    : recordatorioPorTiempo(Number(arg('--minutos') || 0))
  if (!rec) return                                   // el silencio es la respuesta por defecto
  console.log('')
  for (const l of rec.lineas) console.log(l)
  console.log('')
}

try { main() } catch { /* un recordatorio jamás puede estorbar un commit */ }
