// lib/deploy/entorno.cjs — cómo se conecta a la BD algo que corre DESDE EL ÁRBOL DE DEPLOY.
//
// ── POR QUÉ EXISTE, Y POR QUÉ NO ES UNA UTILIDAD GENÉRICA ───────────────────────────────────
// El árbol de deploy (`/home/manuel/vence-deploy` y cualquier worktree dedicado) **no tiene
// `node_modules` ni `.env.local`**: el build va por Docker y nadie los echa en falta. Así que un
// `require('postgres')` o un `readFileSync('.env.local')` que funcionan perfectamente en el repo
// principal revientan justo ahí — y solo ahí.
//
// Esto ya lo había resuelto `scripts/deploy-marcar.cjs` (T-404 bis), con un comentario que decía
// literalmente «apuntar a REPO no servía de nada — fue mi primer intento». El 06/08, al escribir
// el candado de [T-485], se cometió EXACTAMENTE ese error otra vez: lo encontró el primer deploy
// real por el camino nuevo, igual que la vez anterior, y ningún test podía verlo porque en el
// repo principal los módulos sí están.
//
// Por eso se extrae aquí en vez de copiarse por segunda vez: dos copias de la misma solución
// divergen, y la tercera la escribe alguien que no leyó ninguna de las dos.

const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')

/**
 * El checkout PRINCIPAL, visto desde cualquier worktree.
 *
 * `--git-common-dir` apunta al `.git` que comparten todos los worktrees, así que su carpeta padre
 * es el principal. Apuntar al árbol propio no sirve: es justo el que no tiene nada.
 */
function repoPrincipal(desde) {
  const comun = execFileSync('git', ['rev-parse', '--git-common-dir'],
    { cwd: desde, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  return path.resolve(desde, comun, '..')
}

/** `postgres`, con fallback al node_modules del principal cuando este árbol no los tiene. */
function cargarPg(desde) {
  try { return require('postgres') } catch { /* este árbol no tiene node_modules */ }
  return require(path.join(repoPrincipal(desde), 'node_modules', 'postgres'))
}

/**
 * La URL de la BD: entorno primero, y si no, el `.env.local` — el de este árbol o, si no lo tiene,
 * el del principal. Devuelve `null` si no hay ninguna, y **quien llama decide qué hacer con eso**:
 * la telemetría se calla, el candado se niega a desplegar.
 */
function urlBd(desde) {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const candidatos = [path.join(desde, '.env.local')]
  try { candidatos.push(path.join(repoPrincipal(desde), '.env.local')) } catch { /* sin git */ }
  for (const f of candidatos) {
    try {
      const m = fs.readFileSync(f, 'utf8').match(/^DATABASE_URL=(.*)$/m)
      if (m) return m[1].trim()
    } catch { /* siguiente */ }
  }
  return null
}

module.exports = { repoPrincipal, cargarPg, urlBd }
