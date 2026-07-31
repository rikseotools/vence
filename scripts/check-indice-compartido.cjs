#!/usr/bin/env node
/**
 * check-indice-compartido.cjs — puente del guardarraíl «una sesión por índice». (T-415)
 *
 * Lo invoca `.husky/pre-commit`. Reúne los inputs reales (mi sid, mi worktree, las sesiones con
 * latido) y llama a la lógica PURA de `lib/sessions/indiceCompartido.cjs`. Ver ese fichero para
 * el porqué.
 *
 * Filosofía de fallo, la de siempre en este repo:
 *   · FAIL-CLOSED solo en lo que existe para cazar: dos sesiones vivas en el mismo directorio.
 *   · FAIL-OPEN ante cualquier problema de infra (sin BD, sin red, sin sid): avisa y deja pasar.
 *     Bloquear commits porque la telemetría no responde sería peor que el fallo que evita.
 *   · Escape con nombre: INDICE_COMPARTIDO_OK=1, que queda impreso.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.resolve(__dirname, '..')
const { evaluarIndice, mensajeBloqueo } = require(path.join(REPO, 'lib', 'sessions', 'indiceCompartido.cjs'))
const { resolverSid } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

async function main() {
  if (process.env.INDICE_COMPARTIDO_OK === '1') {
    console.log('⏭️  guardarraíl de índice compartido saltado (INDICE_COMPARTIDO_OK=1)')
    return 0
  }
  const { sid } = resolverSid({ repo: REPO })
  if (!sid) return 0                                   // sin identidad no se puede afirmar nada

  let worktreePath = null
  try {
    worktreePath = execFileSync('git', ['rev-parse', '--show-toplevel'],
      { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  } catch { return 0 }

  const u = url()
  if (!u) return 0
  let sesiones = []
  try {
    const postgres = require('postgres')
    const s = postgres(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8, idle_timeout: 2 })
    try {
      sesiones = await s`SELECT sid, worktree_path, last_signal_at FROM public.worktree_sessions`
    } finally { try { await s.end({ timeout: 3 }) } catch {} }
  } catch { return 0 }                                  // BD caída → no bloquea

  const v = evaluarIndice({ sesiones, sid, worktreePath })
  if (v.permitido) return 0
  console.error(mensajeBloqueo({ ...v, worktreePath }))
  return 1
}

main().then((c) => process.exit(c)).catch((e) => {
  console.log(`⚠️  check-indice-compartido: ${String(e.message || e).slice(0, 120)} — commit permitido (fail-open).`)
  process.exit(0)
})
