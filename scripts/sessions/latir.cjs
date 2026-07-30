#!/usr/bin/env node
/**
 * latir.cjs — deja constancia de que ESTA sesión de worktree está viva. (T-296, 30/07/2026)
 *
 * Una línea en `worktree_sessions` con la hora del SERVIDOR. Es la única señal fiable de vida: la
 * fecha del directorio y el `cwd` de las transcripciones ya se probaron y no sirven (el porqué, en
 * `lib/sessions/latido.js`).
 *
 * ## Reglas de diseño, y las tres son a propósito
 *
 * 1. **NUNCA falla hacia fuera.** Sale con 0 aunque no haya BD, red, `.session-id` ni tabla. Lo
 *    invocan `backlog.cjs` y el hook `pre-push`: si esto pudiera romper un push, el primer día que
 *    la BD tosiera alguien añadiría `--no-verify` a su rutina y perderíamos el guard del backlog
 *    entero. Telemetría que bloquea trabajo es peor que no tener telemetría.
 * 2. **Silencioso salvo que se le pida hablar** (`--verbose`): late dentro de otros comandos y su
 *    salida no debe ensuciar la de ellos.
 * 3. **Con presupuesto de tiempo** (`connect_timeout` corto): más vale no latir que colgar un push.
 *
 * Uso:
 *   node scripts/sessions/latir.cjs [--cmd <etiqueta>] [--verbose]
 *   node scripts/sessions/latir.cjs --cerrar <slug>      (al borrar el worktree: quita sus filas)
 *
 * `--cerrar` existe para que el listado no acumule sesiones que apuntan a directorios que ya no
 * están: sin él, cada worktree cerrado dejaba una fila para siempre y la lista volvía a ser ruido.
 * Es el ÚNICO escritor de la tabla, a propósito (una tabla con dos puertas driftea).
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const REPO = path.resolve(__dirname, '../..')
const VERBOSE = process.argv.includes('--verbose')
const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i >= 0 && v && !v.startsWith('--') ? v : null }

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const m = fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)
  return m && m[1].trim()
}

/**
 * El sid se resuelve igual que en `backlog.cjs` y `cola.cjs` (nadie teclea nada), pero se devuelve
 * TAMBIÉN de dónde salió.
 *
 * Y eso no es un detalle: la primera versión sacaba el `sid` del `cwd` y la RUTA del repo de este
 * fichero, así que invocarlo con la ruta absoluta de otro worktree escribía una fila que emparejaba
 * el sid de una sesión con el directorio de otra — o sea, exactamente el dato que esta tarea existe
 * para dejar de adivinar, mal. Salió al probar la puerta de borrado con una sesión desechable.
 * El sid y el directorio tienen que venir del MISMO sitio.
 */
function resolverSesion() {
  for (const base of [process.cwd(), REPO]) {
    try {
      const v = fs.readFileSync(path.join(base, '.session-id'), 'utf8').trim()
      if (v) return { sid: v, base }
    } catch {}
  }
  return { sid: process.env.CLAUDE_CODE_SESSION_ID || null, base: process.cwd() }
}

/** Worktree y rama del directorio de donde salió el sid (ver `resolverSesion`). */
function datosDelWorktree(base) {
  const { execFileSync } = require('child_process')
  const git = (args) => execFileSync('git', args, { cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  try {
    return { worktree: git(['rev-parse', '--show-toplevel']), branch: git(['rev-parse', '--abbrev-ref', 'HEAD']) }
  } catch {
    return { worktree: base, branch: null }
  }
}

async function cerrar(slug) {
  const u = url()
  if (!u) return
  const s = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8, idle_timeout: 2 })
  try {
    const r = await s`DELETE FROM worktree_sessions WHERE slug = ${slug} RETURNING sid`
    if (VERBOSE) console.log(`✅ ${r.length} fila(s) de sesión borradas para ${slug}`)
  } finally {
    try { await s.end({ timeout: 3 }) } catch {}
  }
}

async function main() {
  const slugCerrar = arg('--cerrar')
  if (slugCerrar) return cerrar(slugCerrar)
  const { sid, base } = resolverSesion()
  if (!sid) { if (VERBOSE) console.log('sin .session-id: no hay a quién atribuir el latido'); return }
  const u = url()
  if (!u) { if (VERBOSE) console.log('sin DATABASE_URL: no late'); return }

  const { worktree, branch } = datosDelWorktree(base)
  const slug = path.basename(worktree)
  const s = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8, idle_timeout: 2 })
  try {
    await s`
      INSERT INTO worktree_sessions (sid, slug, worktree_path, branch, host, last_command)
      VALUES (${sid}, ${slug}, ${worktree}, ${branch}, ${os.hostname()}, ${arg('--cmd')})
      ON CONFLICT (sid) DO UPDATE
         SET last_signal_at = now(),
             last_command   = COALESCE(EXCLUDED.last_command, worktree_sessions.last_command),
             -- El worktree y la rama se REFRESCAN: una sesión cambia de rama, y el path es el dato
             -- con el que alguien decidirá borrar.
             slug           = EXCLUDED.slug,
             worktree_path  = EXCLUDED.worktree_path,
             branch         = EXCLUDED.branch,
             signals        = worktree_sessions.signals + 1`
    if (VERBOSE) console.log(`✅ latido: ${sid} · ${slug} · ${branch || '?'}`)
  } finally {
    try { await s.end({ timeout: 3 }) } catch {}
  }
}

// Fail-open TOTAL: cualquier avería sale con 0 y en silencio (ver regla 1 de la cabecera).
main().catch((e) => { if (VERBOSE) console.error('latido no registrado:', String(e.message || e).slice(0, 160)) })
